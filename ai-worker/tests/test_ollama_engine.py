"""HOSO_AI_PROFILE=ollama: mô hình ở máy khác (Ollama), worker gọi qua HTTP. Dùng máy chủ Ollama giả trong tiến trình, không cần mạng."""
from __future__ import annotations

import json
import socket
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

from conftest import FakeReader, FakeStorage, make_job
from hoso_ai.contracts import JobStatus, PageInfo, PageResult
from hoso_ai.engines.base import Engines, EngineUnavailable
from hoso_ai.engines.fake import FakeClassifier, FakeOcr
from hoso_ai.engines.ollama import PADDLE_VL_PROMPT, OllamaClassifier, OllamaClient, _PaddleVlBridge, chatml
from hoso_ai.engines.quality import PillowQualityChecker
from hoso_ai.runtime.scheduler import ModelScheduler
from hoso_ai.settings import Settings, SettingsError
from hoso_ai.worker import Worker

DOC = "ỦY BAN NHÂN DÂN PHƯỜNG TỪ LIÊM\nSố: 12/KH-UBND\nTừ Liêm, ngày 5 tháng 3 năm 2026\nKẾ HOẠCH\nThực hiện nhiệm vụ năm 2026"
MODELS = [{"name": "hoso-ifstruct:q8_0", "model": "hoso-ifstruct:q8_0", "digest": "a6ac33e53fb80dfe"},
          {"name": "hoso-paddleocr-vl:1.6-q8_0", "model": "hoso-paddleocr-vl:1.6-q8_0", "digest": "ecc8315d06f5329a"}]


class FakeOllama:
    """Ollama giả: ghi lại mọi yêu cầu /api/generate, trả lời theo nội dung lời nhắc."""

    def __init__(self):
        self.requests: list[dict] = []
        self.done_reason = "stop"
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def _send(self, payload):
                data = json.dumps(payload).encode()
                self.send_response(200)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_GET(self):
                self._send({"version": "0.40.16"} if self.path == "/api/version" else {"models": MODELS})

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                owner.requests.append(body)
                self._send({"response": owner.answer(body["prompt"]), "done_reason": owner.done_reason,
                            "prompt_eval_count": 100, "eval_count": 20})

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"

    @staticmethod
    def answer(prompt: str) -> str:
        if "Chọn category_code" in prompt:
            return '```json\n{"category_code": "U02", "document_form": "Kế hoạch", "title": "Kế hoạch thực hiện nhiệm vụ năm 2026", ' \
                   '"reason": "Kế hoạch của UBND", "quote": "Thực hiện nhiệm vụ năm 2026", "mixed_documents": false}\n```'
        if "Chọn type_id" in prompt:
            return '{"type_id": "U02-D01"}'
        if "[img-0]" in prompt:
            return "Số: 12/KH-UBND"
        return '{"fields": [{"label": "Số/ký hiệu", "value": "12/KH-UBND", "quote": "Số: 12/KH-UBND"}]}'


@pytest.fixture
def ollama():
    server = FakeOllama()
    yield server
    server.server.shutdown()
    server.server.server_close()


def closed_port_url() -> str:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return f"http://127.0.0.1:{s.getsockname()[1]}"


def test_mau_chat_trung_tokenizer_qwen_che_do_khong_suy_nghi():
    # Bản MLX dựng bằng tokenizer.apply_chat_template(..., enable_thinking=False); đã đối chiếu ra đúng chuỗi này với tokenizer IFStruct.
    assert chatml("SYS", "USR") == "<|im_start|>system\nSYS<|im_end|>\n<|im_start|>user\nUSR<|im_end|>\n<|im_start|>assistant\n"


def test_phan_loai_qua_ollama_dung_ma_classify_va_gui_loi_nhac_tho(ollama, catalog, monkeypatch):
    monkeypatch.setenv("HOSO_AI_SHORTLIST", "off")
    classifier = OllamaClassifier(OllamaClient(ollama.url), "hoso-ifstruct:q8_0")
    classifier.load()
    suggestion = classifier.suggest([PageResult(1, "pdf_text", DOC)], catalog, prompt_style="production")

    assert classifier.version == "hoso-ifstruct:q8_0@a6ac33e"
    assert (suggestion.model_key, suggestion.work_group_code, suggestion.document_type_code) == ("classifier", "U02", "U02-D01")
    assert suggestion.evidence_verified
    number = next(f for f in suggestion.fields if f.label == "Số/ký hiệu")
    assert number.value == "12/KH-UBND" and number.source_pages == (1,)
    assert len(ollama.requests) == 3
    for request in ollama.requests:
        # Mô hình tạo với TEMPLATE {{ .Prompt }}: lời nhắc phải dựng sẵn theo mẫu chat, gửi raw, nhiệt độ 0.
        assert request["raw"] is True and request["stream"] is False
        assert request["options"]["temperature"] == 0 and request["options"]["num_predict"] > 0
        assert request["prompt"].startswith("<|im_start|>system\nBạn hỗ trợ cán bộ") and request["prompt"].endswith("<|im_start|>assistant\n")


def test_thieu_mo_hinh_tren_may_ollama_bao_ro_ten_mo_hinh_dang_co(ollama):
    with pytest.raises(EngineUnavailable, match="chưa có mô hình hoso-khac.*hoso-ifstruct:q8_0"):
        OllamaClassifier(OllamaClient(ollama.url), "hoso-khac").load()


def test_may_ollama_tat_thi_bao_engine_unavailable(catalog):
    classifier = OllamaClassifier(OllamaClient(closed_port_url()), "hoso-ifstruct:q8_0")
    with pytest.raises(EngineUnavailable, match="Không gọi được Ollama"):
        classifier.suggest([PageResult(1, "pdf_text", DOC)], catalog)


def test_bo_chuyen_ocr_doi_yeu_cau_openai_thanh_loi_nhac_paddleocr_vl(ollama):
    bridge = _PaddleVlBridge(OllamaClient(ollama.url), "hoso-paddleocr-vl:1.6-q8_0")
    base = bridge.start()
    try:
        body = {"model": "hoso-paddleocr-vl:1.6-q8_0", "max_tokens": 4096, "temperature": 0,
                "messages": [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "data:image/png;base64,QUJD"}},
                                                          {"type": "text", "text": "OCR:"}]}]}
        request = urllib.request.Request(base + "/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=10) as response:
            reply = json.load(response)
    finally:
        bridge.stop()
    assert reply["choices"][0]["message"]["content"] == "Số: 12/KH-UBND"
    sent = ollama.requests[-1]
    assert sent["prompt"] == PADDLE_VL_PROMPT.format(text="OCR:") == "<|begin_of_sentence|>User: [img-0]OCR:\nAssistant:\n"
    assert sent["images"] == ["QUJD"] and sent["raw"] is True and sent["options"]["num_predict"] == 4096


def test_bo_chuyen_ocr_bao_vuot_do_dai_va_may_ollama_tat(ollama):
    image = {"type": "image_url", "image_url": {"url": "data:image/png;base64,QUJD"}}
    ollama.done_reason = "length"
    status, _ = _PaddleVlBridge(OllamaClient(ollama.url), "m").complete({"messages": [{"role": "user", "content": [image]}]})
    assert status == 422
    assert _PaddleVlBridge(OllamaClient(ollama.url), "m").complete({"messages": [{"role": "user", "content": []}]})[0] == 400

    offline = _PaddleVlBridge(OllamaClient(closed_port_url()), "m")
    status, payload = offline.complete({"messages": [{"role": "user", "content": [image]}]})
    assert status == 503 and offline.unavailable
    # Các vùng cắt còn lại của trang báo ngay, không gọi lại máy đã tắt.
    assert offline.complete({"messages": [{"role": "user", "content": [image]}]})[0] == 503


def test_cau_hinh_ollama_can_dia_chi(tmp_path):
    base = {"HOSO_AI_PROFILE": "ollama", "HOSO_AI_WORK_ROOT": str(tmp_path)}
    with pytest.raises(SettingsError, match="HOSO_AI_OLLAMA_URL"):
        Settings.from_env(base)
    with pytest.raises(SettingsError, match="http://"):
        Settings.from_env(base | {"HOSO_AI_OLLAMA_URL": "100.78.102.53:11434"})
    settings = Settings.from_env(base | {"HOSO_AI_OLLAMA_URL": "http://100.78.102.53:11434/"})
    assert settings.ollama_classifier_model == "hoso-ifstruct:q8_0" and settings.ollama_ocr_concurrency == 1


class OfflineOcr(FakeOcr):
    def read(self, image: Path, timeout_seconds: int):
        self.calls.append(image.name)
        raise EngineUnavailable("Không gọi được Ollama ở http://100.78.102.53:11434: timed out")


def test_may_ai_khong_tra_loi_thi_job_ve_hang_doi_khong_tinh_lan_thu(settings, repo):
    worker = Worker(settings, repo, Engines(FakeReader(), OfflineOcr(), FakeClassifier(), PillowQualityChecker()),
                    FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    repo.enqueue(make_job())
    assert worker.run_once()

    row = repo.rows["job-1"]
    assert row.status is JobStatus.QUEUED and row.preempted == 1          # như nhường chỗ: không tính vào giới hạn thử lại
    assert 2 not in repo.pages.get("job-1", {})                           # không ghi trang "failed" vì lỗi không do trang
    assert worker.state.jobs["engine_unavailable"] == 1
    # Trong lúc đợi máy AI, worker không lấy lại việc ngay (tránh vòng lặp lấy/trả liên tục).
    assert worker.run_once() is False
    assert repo.status("job-1") is JobStatus.QUEUED


def test_may_ai_tat_luc_phan_loai_thi_khong_mat_goi_y(settings, repo):
    class OfflineClassifier(FakeClassifier):
        def suggest(self, pages, catalog, prompt_style="production"):
            raise EngineUnavailable("Không gọi được Ollama")

    worker = Worker(settings, repo, Engines(FakeReader(), FakeOcr(), OfflineClassifier(), PillowQualityChecker()),
                    FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    repo.enqueue(make_job())
    worker.run_once()
    # Trước đây lỗi phân loại chỉ thành cảnh báo "cán bộ chọn tay" và job hoàn tất: máy AI tắt một lúc là mất gợi ý.
    assert repo.status("job-1") is JobStatus.QUEUED
    assert "job-1" not in repo.suggestions
    assert {1, 2, 3} <= set(repo.pages["job-1"])                          # trang đã đọc vẫn giữ, lần sau chỉ phân loại


SOURCE = "ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct@00161de525486e01ba505e6c24f39472fdfe4a23"


def test_nguon_khai_bao_cho_ra_ten_phien_ban_cung_dang_voi_ban_mlx_va_giu_digest_that(ollama):
    from hoso_ai.engines.ollama import source_version

    assert source_version(SOURCE, "hoso-ifstruct:q8_0") == "Qwen3-4B-Instruct-2507-ifstruct-q8_0@00161de"
    assert source_version(SOURCE, "ifstruct:4b-q4_k_m") == "Qwen3-4B-Instruct-2507-ifstruct-q4_k_m@00161de"
    classifier = OllamaClassifier(OllamaClient(ollama.url), "hoso-ifstruct:q8_0", SOURCE)
    classifier.load()
    assert classifier.version == "Qwen3-4B-Instruct-2507-ifstruct-q8_0@00161de"
    assert classifier.deployment == "hoso-ifstruct:q8_0@a6ac33e"          # digest thật trên máy Ollama, ghi riêng
    undeclared = OllamaClassifier(OllamaClient(ollama.url), "hoso-ifstruct:q8_0")
    undeclared.load()
    assert undeclared.version == "hoso-ifstruct:q8_0@a6ac33e" and undeclared.deployment is None     # không khai thì không tự nhận nguồn


def test_model_version_ghi_ca_nguon_khai_bao_lan_noi_chay_that(settings, repo, ollama, monkeypatch):
    monkeypatch.setenv("HOSO_AI_SHORTLIST", "off")
    from conftest import FakeReader
    classifier = OllamaClassifier(OllamaClient(ollama.url), "hoso-ifstruct:q8_0", SOURCE)
    worker = Worker(settings, repo, Engines(FakeReader([PageInfo(1, "", has_images=True)]), FakeOcr(), classifier, PillowQualityChecker()),
                    FakeStorage(Path("/tmp/fake.pdf")), ModelScheduler(6))
    repo.enqueue(make_job())
    worker.run_once()
    version = repo.rows["job-1"].model_version
    assert "classifier=Qwen3-4B-Instruct-2507-ifstruct-q8_0@00161de/" in version and version.endswith("classifier-via=hoso-ifstruct:q8_0@a6ac33e")


def test_nguon_khai_sai_dang_thi_dung_khoi_dong(tmp_path):
    base = {"HOSO_AI_PROFILE": "ollama", "HOSO_AI_OLLAMA_URL": "http://x:11434", "HOSO_AI_WORK_ROOT": str(tmp_path)}
    assert Settings.from_env(base | {"HOSO_AI_OLLAMA_CLASSIFIER_SOURCE": SOURCE}).ollama_classifier_source == SOURCE
    assert Settings.from_env(base).ollama_classifier_source is None
    with pytest.raises(SettingsError, match="repo@commit"):
        Settings.from_env(base | {"HOSO_AI_OLLAMA_CLASSIFIER_SOURCE": "Qwen3-4B-ifstruct"})


def test_tham_do_may_ollama_can_ca_may_tra_loi_lan_du_mo_hinh(ollama):
    from hoso_ai.engines.ollama import probe

    probe(OllamaClient(ollama.url), "hoso-ifstruct:q8_0", "hoso-paddleocr-vl:1.6-q8_0")
    with pytest.raises(EngineUnavailable, match="chưa có mô hình hoso-khac"):
        probe(OllamaClient(ollama.url), "hoso-ifstruct:q8_0", "hoso-khac")
    with pytest.raises(EngineUnavailable, match="Không gọi được Ollama"):
        probe(OllamaClient(closed_port_url()), "hoso-ifstruct:q8_0")


def test_ho_so_ollama_gan_ham_tham_do_va_ten_may(tmp_path, ollama):
    from hoso_ai.engines.factory import build_engines

    engines = build_engines(Settings.from_env({"HOSO_AI_PROFILE": "ollama", "HOSO_AI_OLLAMA_URL": ollama.url,
                                               "HOSO_AI_WORK_ROOT": str(tmp_path), "HOSO_AI_STORAGE_ROOT": str(tmp_path)}))
    assert engines.engine == f"Ollama {ollama.url}"
    engines.probe()
