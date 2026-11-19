"""Mô hình chạy trên một máy khác qua Ollama (ví dụ máy Windows có GPU, nối bằng Tailscale). HOSO_AI_PROFILE=ollama.

Worker vẫn chạy cạnh CSDL và kho tệp (không phải mở PostgreSQL hay chia sẻ thư mục kho ra mạng). Chỉ phần sinh chữ chạy ở máy kia:
- OCR: pipeline PaddleOCR-VL chạy ở máy này (dò bố cục PP-DocLayoutV3, xoay trang; CPU). Từng vùng cắt gửi sang PaddleOCR-VL trên Ollama.
- Phân loại, trích trường: đúng mã document_ai.classify như bản MLX, chỉ khác chỗ sinh chữ.

Mô hình trên Ollama được tạo với TEMPLATE {{ .Prompt }}: bên gọi tự dựng lời nhắc theo mẫu chat của mô hình rồi gửi /api/generate raw=true.
Đi đường /v1/chat/completions thì Ollama không bọc đúng mẫu và PaddleOCR-VL sinh thêm chữ rác, nên OCR đi qua một bộ chuyển nhỏ
(_PaddleVlBridge) chạy trong worker: pipeline Paddle gọi nó theo giao thức OpenAI như với máy chủ MLX.

Máy kia tắt hoặc mất mạng thì ném EngineUnavailable: pipeline không ghi trang lỗi, worker trả job về hàng đợi rồi đợi một lúc.
"""
from __future__ import annotations

import gc
import json
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from .. import logging as log
from ..contracts import PageResult, Suggestion
from ..queue.repository import Catalog
from ..regions import blocks_with_regions
from .base import EngineUnavailable

# Mẫu chat của PaddleOCR-VL-1.6 (chat_template.jinja của mô hình gốc). llama.cpp tự bọc ảnh bằng <|IMAGE_START|>…<|IMAGE_END|> tại [img-0].
PADDLE_VL_PROMPT = "<|begin_of_sentence|>User: [img-0]{text}\nAssistant:\n"
PING_SECONDS = 5


def chatml(system: str, prompt: str) -> str:
    """Mẫu chat của Qwen3-4B-Instruct-2507 (IFStruct tinh chỉnh từ nó). Trùng từng ký tự với tokenizer.apply_chat_template(..., enable_thinking=False) mà bản MLX dùng."""
    return f"<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n"


class OllamaClient:
    def __init__(self, base_url: str, timeout_seconds: float = 300):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def _call(self, path: str, body: dict | None = None, timeout: float | None = None) -> dict:
        request = urllib.request.Request(self.base_url + path, data=None if body is None else json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json"}, method="GET" if body is None else "POST")
        try:
            with urllib.request.urlopen(request, timeout=timeout or self.timeout_seconds) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            detail = error.read()[:500].decode("utf-8", errors="replace")
            if error.code == 404:      # mô hình chưa có trên máy kia: lỗi cấu hình ở đó, không phải lỗi tài liệu
                raise EngineUnavailable(f"Ollama ở {self.base_url} báo không thấy mô hình: {detail}") from error
            raise RuntimeError(f"Ollama trả lỗi {error.code}: {detail}") from error
        except urllib.error.URLError as error:      # không kết nối được (máy tắt, mất mạng, Tailscale ngắt)
            raise EngineUnavailable(f"Không gọi được Ollama ở {self.base_url}: {error.reason}") from error
        except TimeoutError as error:               # đã kết nối nhưng mô hình trả lời quá lâu: tính là lỗi của lần đọc này
            raise RuntimeError(f"Ollama không trả lời trong {timeout or self.timeout_seconds:.0f} giây.") from error
        except (ConnectionError, OSError) as error:  # đứt giữa chừng
            raise EngineUnavailable(f"Mất kết nối tới Ollama ở {self.base_url}: {error}") from error

    def ping(self) -> None:
        """Kiểm tra nhanh máy kia còn trả lời, để báo ngay thay vì đợi hết hạn của từng lần gọi."""
        try:
            self._call("/api/version", timeout=PING_SECONDS)
        except EngineUnavailable:
            raise
        except Exception as error:
            raise EngineUnavailable(f"Ollama ở {self.base_url} không trả lời: {error}") from error

    def require(self, model: str) -> str:
        """Mô hình phải có sẵn trên máy kia. Trả 'tên@digest7' để ghi vào ocr_jobs.model_version."""
        found = self._call("/api/tags", timeout=PING_SECONDS * 2).get("models", [])
        for item in found:
            if model in (item.get("name"), item.get("model")):
                digest = str(item.get("digest", ""))
                return f"{model}@{digest[:7]}" if digest else model
        names = ", ".join(sorted(str(m.get("name")) for m in found)) or "(không có)"
        raise EngineUnavailable(f"Ollama ở {self.base_url} chưa có mô hình {model}. Đang có: {names}.")

    def generate(self, model: str, prompt: str, *, max_tokens: int, images: list[str] | None = None, timeout: float | None = None) -> dict:
        body = {"model": model, "prompt": prompt, "raw": True, "stream": False,
                "options": {"temperature": 0, "num_predict": max_tokens}}
        if images:
            body["images"] = images
        return self._call("/api/generate", body, timeout)


class _PaddleVlBridge:
    """Máy chủ HTTP nhỏ trong worker (chỉ nghe 127.0.0.1), nói giao thức OpenAI mà pipeline PaddleOCR-VL dùng để gửi từng vùng cắt,
    rồi chuyển thành /api/generate raw với mẫu chat PaddleOCR-VL. Giống vai trò của document_ai/vlm.py với MLX."""

    def __init__(self, client: OllamaClient, model: str):
        self.client = client
        self.model = model
        self.unavailable: str | None = None     # đặt khi máy kia không trả lời trong lần đọc trang hiện tại
        self._server: ThreadingHTTPServer | None = None

    def start(self) -> str:
        bridge = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args) -> None:
                pass

            def _send(self, status: int, payload: dict) -> None:
                data = json.dumps(payload, ensure_ascii=False).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self) -> None:
                if self.path.rstrip("/") == "/v1/models":
                    self._send(200, {"object": "list", "data": [{"id": bridge.model, "object": "model"}]})
                else:
                    self._send(404, {"error": {"message": "Không có đường dẫn này."}})

            def do_POST(self) -> None:
                if self.path.rstrip("/") != "/v1/chat/completions":
                    self._send(404, {"error": {"message": "Không có đường dẫn này."}})
                    return
                try:
                    body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)))
                except ValueError:
                    self._send(400, {"error": {"message": "Thân yêu cầu không phải JSON."}})
                    return
                self._send(*bridge.complete(body))

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._server.daemon_threads = True
        threading.Thread(target=self._server.serve_forever, name="paddle-vl-bridge", daemon=True).start()
        return f"http://127.0.0.1:{self._server.server_address[1]}/v1"

    def stop(self) -> None:
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
            self._server = None

    def complete(self, body: dict) -> tuple[int, dict]:
        if self.unavailable:     # đã biết máy kia không trả lời: báo ngay cho các vùng cắt còn lại của trang
            return 503, {"error": {"message": self.unavailable}}
        texts, images = [], []
        for message in body.get("messages") or []:
            content = message.get("content")
            if isinstance(content, str):
                texts.append(content)
                continue
            for item in content or []:
                if item.get("type") == "text":
                    texts.append(str(item.get("text", "")))
                elif item.get("type") == "image_url":
                    url = item.get("image_url")
                    url = url.get("url", "") if isinstance(url, dict) else str(url or "")
                    if not url.startswith("data:image/") or "," not in url:
                        return 400, {"error": {"message": "Chỉ nhận ảnh dạng data URL."}}
                    images.append(url.split(",", 1)[1])
        if len(images) != 1:
            return 400, {"error": {"message": "Mỗi lần đọc đúng một vùng ảnh."}}
        max_tokens = int(body.get("max_tokens") or body.get("max_completion_tokens") or 4096)
        try:
            result = self.client.generate(self.model, PADDLE_VL_PROMPT.format(text="\n".join(texts)), max_tokens=max_tokens, images=images)
        except EngineUnavailable as error:
            self.unavailable = str(error)
            return 503, {"error": {"message": str(error)}}
        except Exception as error:
            return 502, {"error": {"message": f"{type(error).__name__}: {error}"}}
        if result.get("done_reason") == "length":
            return 422, {"error": {"message": "Vùng OCR vượt giới hạn độ dài kết quả; cần xem bản gốc."}}
        prompt_tokens, output_tokens = int(result.get("prompt_eval_count") or 0), int(result.get("eval_count") or 0)
        return 200, {"id": "ollama-ocr", "object": "chat.completion", "created": int(time.time()), "model": self.model,
                     "choices": [{"index": 0, "message": {"role": "assistant", "content": result.get("response", "")}, "finish_reason": "stop"}],
                     "usage": {"prompt_tokens": prompt_tokens, "completion_tokens": output_tokens, "total_tokens": prompt_tokens + output_tokens}}


class PaddleVlOllamaOcr:
    key = "ocr"
    approx_gb = 1.0     # chỉ dò bố cục và xoay trang trên CPU máy này; mô hình đọc chữ nằm ở máy Ollama

    def __init__(self, client: OllamaClient, model: str, concurrency: int = 1):
        self.client = client
        self.model = model
        self.concurrency = concurrency
        self.version = model         # thêm digest khi nạp (require)
        self._bridge: _PaddleVlBridge | None = None
        self._pipeline = None

    def load(self) -> None:
        import os

        from document_ai.config import local_environment, model_path

        self.version = self.client.require(self.model)
        os.environ.update(local_environment())
        bridge = _PaddleVlBridge(self.client, self.model)
        url = bridge.start()
        try:
            from paddleocr import PaddleOCRVL

            self._pipeline = PaddleOCRVL(
                pipeline_version="v1.6", device="cpu", cpu_threads=4,
                layout_detection_model_dir=str(model_path("layout")),
                doc_orientation_classify_model_dir=str(model_path("orientation")),
                use_doc_orientation_classify=True, use_doc_unwarping=False,
                # llama-cpp-server: Paddle gửi ảnh PNG và tham số max_tokens, hợp với mô hình GGUF trên Ollama.
                vl_rec_backend="llama-cpp-server", vl_rec_server_url=url,
                vl_rec_api_model_name=self.model, vl_rec_max_concurrency=self.concurrency,
                use_queues=False, use_seal_recognition=True, use_ocr_for_image_block=True,
                markdown_ignore_labels=[],
            )
        except BaseException:
            bridge.stop()
            raise
        self._bridge = bridge

    def unload(self) -> None:
        self._pipeline = None
        if self._bridge is not None:
            self._bridge.stop()
            self._bridge = None
        gc.collect()

    def read(self, image: Path, timeout_seconds: int) -> tuple[str, list]:
        self.client.ping()           # máy kia tắt thì báo ngay, không đợi hết hạn của từng vùng cắt
        bridge = self._bridge
        bridge.unavailable = None
        try:
            result = next(iter(self._pipeline.predict(str(image), max_new_tokens=4096)))
        except Exception as error:
            if bridge.unavailable:
                raise EngineUnavailable(bridge.unavailable) from error
            raise
        if bridge.unavailable:       # Paddle có thể bỏ qua vùng lỗi và trả trang thiếu chữ: không lưu trang như vậy
            raise EngineUnavailable(bridge.unavailable)
        data = result.json.get("res", result.json)
        blocks = blocks_with_regions(data)      # AI-21: kèm vùng theo tỉ lệ trang để sau này tìm vùng nguồn của trường
        text = "\n\n".join(str(b.get("block_content", "")) for b in blocks).strip()
        return text, blocks


class OllamaChatModel:
    """Có .label và .complete() như document_ai.classify.ClassifierModel, nhưng sinh chữ trên máy Ollama."""

    def __init__(self, client: OllamaClient, model: str):
        self.client = client
        self.model = model
        self.label = f"{model} · Ollama"

    def complete(self, system: str, prompt: str, max_tokens: int) -> str:
        started = time.monotonic()
        result = self.client.generate(self.model, chatml(system, prompt), max_tokens=max_tokens)
        # Số token giúp thấy văn bản có sát giới hạn ngữ cảnh của mô hình trên Ollama (num_ctx trong Modelfile) hay không.
        log.info("ollama_generate", model=self.model, seconds=round(time.monotonic() - started, 2), prompt_tokens=result.get("prompt_eval_count"),
                 output_tokens=result.get("eval_count"), done_reason=result.get("done_reason"))
        return str(result.get("response", ""))


class OllamaClassifier:
    """Phân loại và trích trường bằng IFStruct trên Ollama. Không giữ gì trong RAM máy này."""
    key = "classifier"
    approx_gb = 0.0

    def __init__(self, client: OllamaClient, model: str, source: str | None = None):
        self.client = client
        self.model = model
        self.source = source
        self.version = model         # thêm digest khi nạp (require)
        self.deployment: str | None = None
        self._llm: OllamaChatModel | None = None

    def load(self) -> None:
        served = self.client.require(self.model)
        self.version, self.deployment = (source_version(self.source, self.model), served) if self.source else (served, None)
        self._llm = OllamaChatModel(self.client, self.model)

    def unload(self) -> None:
        self._llm = None

    def suggest(self, pages: list[PageResult], catalog: Catalog, prompt_style: str = "production") -> Suggestion:
        from .llm_suggest import suggest_with

        self.client.ping()
        if self._llm is None:
            self.load()
        return suggest_with(self._llm, self.key, pages, catalog, prompt_style)


def source_version(source: str, model: str) -> str:
    """Nhãn phiên bản theo nguồn mà người vận hành khai ("repo@commit"): `<tên repo>-<lượng tử hóa của thẻ Ollama>@<commit 7 ký tự>`,
    cùng dạng với bản MLX tự chuyển (`...-4bit@00161de`) để trang vận hành so với ai_models. Worker không kiểm được lời khai này;
    digest thật của mô hình trên Ollama vẫn được ghi riêng (`classifier-via=` trong ocr_jobs.model_version)."""
    repo, commit = source.rsplit("@", 1)
    quant = model.split(":", 1)[1].rsplit("-", 1)[-1] if ":" in model else "ollama"
    return f"{repo.rsplit('/', 1)[-1]}-{quant}@{commit[:7]}"


def probe(client: OllamaClient, *models: str) -> None:
    """Thăm dò cho worker lúc rảnh (AI-24): máy Ollama trả lời và có đủ mô hình. Ném EngineUnavailable nếu không."""
    client.ping()
    for model in models:
        client.require(model)


def readiness(client: OllamaClient, ocr_model: str, classifier_model: str) -> dict:
    """Cho lệnh `status`: máy Ollama có trả lời, có đủ hai mô hình; máy này có mô hình dò bố cục."""
    from document_ai.config import MODELS, model_path

    info: dict = {"ollama": client.base_url}
    try:
        info["version"] = client._call("/api/version", timeout=PING_SECONDS).get("version")
        info["models"] = {name: client.require(name) for name in (ocr_model, classifier_model)}
    except EngineUnavailable as error:
        info["error"] = str(error)
    missing = [name for name in ("layout", "orientation") if not (model_path(name) / MODELS[name][3]).is_file()]
    info["local_models_missing"] = missing
    info["ready"] = "error" not in info and not missing
    return info
