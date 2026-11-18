#!/usr/bin/env python3
"""QA-07. Kiểm tra thông luồng AI qua API thật (không qua giao diện):
tải PDF lên → vào khay nền → "Trích xuất ngay" đưa một giấy tờ lên trước → worker đọc (SSE báo tiến độ) →
gợi ý của AI → đối chiếu → (tùy chọn) xếp vào hồ sơ.

Chạy sau `scripts/dev-up.sh start`:
    python3 scripts/smoke-ai-flow.py                     # tải 3 PDF mẫu, kiểm thứ tự và gợi ý
    python3 scripts/smoke-ai-flow.py --file-to-dossier   # thêm: xác nhận phân loại, sửa trường, xếp vào hồ sơ mới

Chỉ dùng thư viện chuẩn. Mỗi lần chạy thêm dấu riêng vào cuối PDF để mã băm khác nhau (không bị chặn tải trùng).
Dữ liệu thử nằm lại trong CSDL dev, giấy tờ được bỏ khỏi hộp tiếp nhận ở cuối (trừ khi --file-to-dossier).
Mã thoát 0 khi mọi kiểm tra qua, 1 khi có kiểm tra hỏng.
"""
from __future__ import annotations

import argparse
import http.cookiejar
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDFS = ["filled-u15-d07", "filled-u02-d01", "filled-u08-d01"]     # ba mẫu quét giả lập, có lớp chữ rỗng nên phải OCR


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar), NoRedirect)
        self.assignment: str | None = None

    def request(self, method: str, path: str, body=None, raw: bytes | None = None, content_type: str | None = None, timeout=60):
        headers = {"Accept": "application/json"}
        if method != "GET":
            headers["X-CSRF"] = "1"
        if self.assignment:
            headers["X-Assignment-Id"] = self.assignment
        data = raw
        if body is not None:
            data = json.dumps(body).encode()
            content_type = "application/json"
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with self.opener.open(req, timeout=timeout) as response:
                text = response.read().decode() or "null"
                return response.status, json.loads(text) if "json" in response.headers.get("Content-Type", "") else text
        except urllib.error.HTTPError as error:
            text = error.read().decode(errors="replace")
            try:
                return error.code, json.loads(text)
            except ValueError:
                return error.code, text

    def get(self, path, **kw):
        return self.request("GET", path, **kw)

    def post(self, path, body=None, **kw):
        return self.request("POST", path, body=body, **kw)


def multipart(name: str, content: bytes) -> tuple[bytes, str]:
    boundary = "----smoke" + uuid.uuid4().hex
    head = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: application/pdf\r\n\r\n'.encode()
    return head + content + f"\r\n--{boundary}--\r\n".encode(), f"multipart/form-data; boundary={boundary}"


class Events(threading.Thread):
    """Nghe SSE /api/v1/events, ghi (giây, loại, dữ liệu) để đối chiếu thứ tự hoàn tất."""

    def __init__(self, api: Api):
        super().__init__(daemon=True)
        self.api, self.items, self.started = api, [], time.monotonic()

    def run(self):
        req = urllib.request.Request(self.api.base + "/api/v1/events", headers={"Accept": "text/event-stream", **({"X-Assignment-Id": self.api.assignment} if self.api.assignment else {})})
        try:
            with self.api.opener.open(req, timeout=3600) as response:
                kind = None
                for raw in response:
                    line = raw.decode().rstrip("\n")
                    if line.startswith("event:"):
                        kind = line[6:].strip()
                    elif line.startswith("data:") and kind:
                        try:
                            self.items.append((time.monotonic() - self.started, kind, json.loads(line[5:])))
                        except ValueError:
                            pass
        except Exception as error:      # kết nối đóng khi script thoát
            self.items.append((time.monotonic() - self.started, "closed", {"error": str(error)}))

    def completed_at(self, job_id: str):
        return next((t for t, kind, data in self.items if kind == "job.completed" and data.get("jobId") == job_id), None)


failures: list[str] = []


def worker_profile(url: str) -> str | None:
    """AI worker đang dùng (mac-mlx, fake…), từ /health; None khi không hỏi được."""
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return json.loads(response.read().decode()).get("profile")
    except Exception:
        return None


def scope_groups(api: "Api", me: dict, role: str) -> list[str]:
    """Mã nhóm hồ sơ thuộc phòng của phân công đang dùng (nơi phân công được tạo hồ sơ)."""
    mine = next((a for a in me["assignments"] if a["role"] == role), {})
    query = urllib.parse.urlencode({k: v for k, v in (("organization", mine.get("organizationCode")), ("department", mine.get("departmentCode"))) if v})
    status, groups = api.get("/api/v1/catalog/work-groups" + (f"?{query}" if query else ""))
    return [g["code"] for g in groups] if status == 200 and isinstance(groups, list) else []


def check(condition: bool, message: str, detail: str = "") -> bool:
    print(("  ✓ " if condition else "  ✗ ") + message + (f"  [{detail}]" if detail and not condition else ""))
    if not condition:
        failures.append(message)
    return condition


def step(title: str):
    print(f"\n== {title}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--api", default="http://localhost:5080")
    parser.add_argument("--username", default="dev_admin", help="tài khoản giả lập (dev-login)")
    parser.add_argument("--role", default="employee", help="vai trò của phân công dùng để thử")
    parser.add_argument("--pdf", action="append", help="id mẫu trong data/filled-samples/pdf (lặp lại để chọn nhiều); mặc định 3 mẫu")
    parser.add_argument("--timeout", type=int, default=420, help="giây chờ tối đa cho cả ba giấy tờ đọc xong")
    parser.add_argument("--file-to-dossier", action="store_true", help="thêm bước xác nhận phân loại, sửa trường và xếp vào hồ sơ mới")
    parser.add_argument("--expect-model", default=None, help="tên mô hình phải có trong ocr_jobs.model_version (rỗng để bỏ qua); "
                        "mặc định IFStruct, hoặc fake-classifier khi worker chạy AI giả")
    parser.add_argument("--worker", default="http://127.0.0.1:9108/health", help="địa chỉ /health của worker, để biết worker dùng AI thật hay giả")
    parser.add_argument("--db", default="hoso_dev", help="CSDL để kiểm model_version bằng psql (rỗng để bỏ qua)")
    args = parser.parse_args()
    samples = args.pdf or DEFAULT_PDFS
    fake = worker_profile(args.worker) == "fake"
    if args.expect_model is None:
        args.expect_model = "fake-classifier" if fake else "Qwen3-4B-Instruct-2507-ifstruct-4bit"
    if fake:
        print("Worker đang dùng AI GIẢ (HOSO_AI_PROFILE=fake): kiểm luồng, không kiểm độ đúng của loại giấy tờ.")
    api = Api(args.api)
    started = time.monotonic()

    step("1. Đăng nhập")
    status, _ = api.get(f"/api/v1/auth/dev-login?username={urllib.parse.quote(args.username)}&returnUrl=/")
    if not check(status in (200, 302), f"dev-login {args.username}", f"HTTP {status}; API chạy ở môi trường Development chưa?"):
        return 1
    status, me = api.get("/api/v1/me")
    if not check(status == 200, "GET /me", f"HTTP {status}"):
        return 1
    mine = [a for a in me["assignments"] if a["role"] == args.role]
    if not check(bool(mine), f"có phân công vai trò {args.role}", "tài khoản không có phân công này"):
        return 1
    api.assignment = mine[0]["id"]
    print(f"  phân công: {mine[0].get('roleName')} · {mine[0].get('departmentName') or mine[0].get('organizationName')}")

    events = Events(api)
    events.start()
    time.sleep(1)

    step("2. Tải PDF lên (vào khay nền)")
    uploads = []
    for sample in samples:
        path = ROOT / "data/filled-samples/pdf" / f"{sample}.pdf"
        if not path.is_file():
            print(f"  không thấy {path}", file=sys.stderr)
            return 2
        body, ctype = multipart(f"smoke-{sample}.pdf", path.read_bytes() + f"\n% smoke {uuid.uuid4()}\n".encode())
        status, up = api.post("/api/v1/intake/files", raw=body, content_type=ctype)
        if not check(status == 201, f"tải {sample}", f"HTTP {status}: {up}"):
            return 1
        uploads.append({"sample": sample, **up})
    for item in uploads:
        status, job = api.get(f"/api/v1/jobs/{item['jobId']}")
        item["job_at_upload"] = job
        check(job.get("queueKind") == "background", f"{item['sample']}: vào khay nền", f"queueKind={job.get('queueKind')} status={job.get('status')}")

    step("3. Trích xuất ngay giấy tờ cuối (đang chờ sau các giấy tờ trước)")
    urgent = uploads[-1]
    time.sleep(1)
    status, result = api.post(f"/api/v1/documents/{urgent['documentId']}/ai/extract")
    if check(status == 200, "POST /documents/{id}/ai/extract", f"HTTP {status}: {result}"):
        item = result["items"][0]
        check(item["outcome"] in ("raised", "running"), f"kết quả {item['outcome']}", json.dumps(item, ensure_ascii=False))
        check(item["queueKind"] == "priority", "chuyển sang khay ưu tiên", str(item["queueKind"]))
        print(f"  vị trí {item['queuePosition']}, ước tính {item['etaSeconds']} giây")
    status, again = api.post(f"/api/v1/documents/{urgent['documentId']}/ai/extract")
    check(status == 200 and again["items"][0]["jobId"] == urgent["jobId"], "bấm lại không tạo việc trùng")

    step("4. Chờ worker đọc xong")
    deadline = time.monotonic() + args.timeout
    done: dict[str, dict] = {}
    while time.monotonic() < deadline and len(done) < len(uploads):
        for item in uploads:
            if item["jobId"] in done:
                continue
            status, job = api.get(f"/api/v1/jobs/{item['jobId']}")
            if status == 200 and job["status"] in ("completed", "failed", "cancelled"):
                done[item["jobId"]] = job
        time.sleep(3)
    for item in uploads:
        job = done.get(item["jobId"])
        check(job is not None and job["status"] == "completed", f"{item['sample']}: đọc xong", f"{job['status'] if job else 'chưa xong sau ' + str(args.timeout) + ' giây'} {job.get('error') if job else ''}")
    time.sleep(1)
    times = {item["sample"]: events.completed_at(item["jobId"]) for item in uploads}
    print("  SSE job.completed (giây từ lúc mở luồng): " + ", ".join(f"{k}={'%.0f' % v if v else '—'}" for k, v in times.items()))
    check(any(kind == "job.progress" for _, kind, _ in events.items), "SSE có job.progress")
    check(all(v is not None for v in times.values()), "SSE có job.completed cho từng giấy tờ")
    others = [t for k, t in times.items() if k != urgent["sample"] and t]
    if times.get(urgent["sample"]) and len(uploads) >= 3:
        # Giấy tờ đầu có thể đã chạy trước khi bấm; giấy tờ giữa chưa chạy nên phải xong SAU giấy tờ được nâng mức.
        middle = times[uploads[1]["sample"]]
        check(middle is None or times[urgent["sample"]] < middle, "giấy tờ được nâng mức xong trước giấy tờ cùng khay đứng trước nó",
              f"nâng mức={times[urgent['sample']]:.0f}s, giấy tờ giữa={middle:.0f}s" if middle else "")

    step("5. Gợi ý của AI và đối chiếu")
    answers = json.loads((ROOT / "data/filled-samples/answers.json").read_text(encoding="utf-8"))
    for item in uploads:
        status, review = api.get(f"/api/v1/documents/{item['documentId']}/review")
        if not check(status == 200, f"{item['sample']}: GET /review", f"HTTP {status}"):
            continue
        suggestion = review.get("suggestion")
        if not check(suggestion is not None, f"{item['sample']}: có gợi ý", "chưa có ai_suggestions"):
            continue
        expected = answers.get(item["sample"], {}).get("expected_type_id")
        got = suggestion.get("documentTypeCode")
        filled = [f for f in review["fields"] if f.get("suggestedValue")]
        print(f"  {item['sample']}: loại {got} (mẫu: {expected}), {len(filled)}/{len(review['fields'])} trường có giá trị, "
              f"mô hình {suggestion.get('modelKey')}")
        check(bool(suggestion.get("workGroupCode")), f"{item['sample']}: có nhóm")
        check(all(f.get("quoteVerified") for f in filled), f"{item['sample']}: mọi giá trị đều có trích dẫn khớp văn bản")
        item["review"] = review

    if args.expect_model and args.db:
        step(f"6. Mô hình ghi trong ocr_jobs.model_version (cần có {args.expect_model})")
        for item in uploads:
            out = subprocess.run(["psql", "-h", "127.0.0.1", "-U", "quoc", "-d", args.db, "-Atc",
                                  f"SELECT model_version FROM hoso.ocr_jobs WHERE id = '{item['jobId']}'"], capture_output=True, text=True)
            check(args.expect_model in out.stdout, f"{item['sample']}: {out.stdout.strip() or out.stderr.strip()}")

    if args.file_to_dossier:
        step("7. Xác nhận, sửa trường, xếp vào hồ sơ")
        target = next((i for i in uploads if i.get("review", {}).get("suggestion")), None)
        if not check(target is not None, "có giấy tờ đã được AI gợi ý"):
            return 1
        suggestion = target["review"]["suggestion"]
        if fake:
            in_scope = scope_groups(api, me, args.role)
            if in_scope and suggestion.get("workGroupCode") not in in_scope:
                # AI giả chọn loại theo mẫu chữ, không theo phạm vi người dùng: chọn tay một loại trong phạm vi, như cán bộ sẽ làm trên màn đối chiếu.
                status, types = api.get(f"/api/v1/catalog/work-groups/{in_scope[0]}/document-types")
                if check(status == 200 and bool(types), f"AI giả chọn nhóm {suggestion.get('workGroupCode')} ngoài phạm vi; lấy loại của nhóm {in_scope[0]}", f"HTTP {status}"):
                    suggestion = {**suggestion, "workGroupCode": in_scope[0], "documentTypeCode": types[0]["code"]}
        fields = target["review"]["fields"]
        if suggestion.get("documentTypeCode"):
            status, classified = api.request("PUT", f"/api/v1/documents/{target['documentId']}/classification",
                                             body={"workGroupCode": suggestion["workGroupCode"], "documentTypeCode": suggestion["documentTypeCode"]})
            if check(status == 200, "xác nhận phân loại", f"HTTP {status}") and isinstance(classified, dict):
                fields = classified.get("fields", fields)     # trường theo loại vừa xác nhận
        first = next((f for f in fields if f.get("suggestedValue")), None)
        if first:
            status, _ = api.request("PATCH", f"/api/v1/documents/{target['documentId']}/fields",
                                    body={"fields": [{"fieldCode": first["fieldCode"], "value": first["suggestedValue"], "verify": True}]})
            check(status == 200, f"xác nhận trường {first['label']}", f"HTTP {status}")
        status, dossier = api.post("/api/v1/dossiers", {"title": f"Hồ sơ thử luồng AI {uuid.uuid4().hex[:6]}", "workGroupCode": suggestion["workGroupCode"]})
        if check(status == 201, "tạo hồ sơ", f"HTTP {status}: {dossier}"):
            status, _ = api.post(f"/api/v1/dossiers/{dossier['id']}/documents", {"documentId": target["documentId"], "direction": "internal"})
            check(status == 200, "xếp giấy tờ vào hồ sơ", f"HTTP {status}")
            status, detail = api.get(f"/api/v1/dossiers/{dossier['id']}")
            check(status == 200, f"mở hồ sơ {dossier.get('code')}", f"HTTP {status}")
    else:
        step("7. Dọn: bỏ các giấy tờ thử khỏi hộp tiếp nhận")
        for item in uploads:
            status, _ = api.post(f"/api/v1/intake/documents/{item['documentId']}/discard")
            check(status in (200, 204), f"bỏ {item['sample']}", f"HTTP {status}")

    print(f"\nTổng thời gian {time.monotonic() - started:.0f} giây · {len(failures)} kiểm tra hỏng")
    for message in failures:
        print(f"  ✗ {message}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
