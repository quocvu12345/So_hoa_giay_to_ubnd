#!/usr/bin/env python3
"""QA-07 (phần 2). Các đường đi ngoài luồng chính của AI, chạy trên stack dev THẬT (`scripts/dev-up.sh start`):

  text      PDF có lớp chữ sạch: không OCR, nhanh
  mixed     PDF vừa có lớp chữ vừa có trang quét: chỉ OCR trang quét
  packet    gói quét 7 trang gồm nhiều giấy tờ: AI có báo "cần tách" không
  handsim   biểu mẫu điền tay mô phỏng có đáp án: đo trường đúng/sai
  reread    đọc lại một trang: chỉ trang đó, không đổi gợi ý cũ
  force     "Trích xuất lại" (reclassify): chỉ gợi ý lại, không OCR lại
  cancel    hủy việc đang chờ và việc đang chạy
  crash     worker bị giết giữa chừng: việc được thu hồi và chạy tiếp từ trang còn thiếu

    python3 scripts/smoke-ai-edge.py                 # chạy tất cả (khoảng 6–8 phút)
    python3 scripts/smoke-ai-edge.py text reread     # chọn một số

In ra mọi quan sát (thời gian, số trang, kết quả AI) để đọc, không chỉ đạt/không đạt. Mã thoát 1 khi có kiểm tra hỏng.
"""
from __future__ import annotations

import importlib.util
import json
import os
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("flow", ROOT / "scripts/smoke-ai-flow.py")
flow = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flow)
check, step, Api = flow.check, flow.step, flow.Api

SAMPLES = ROOT / "data/citizen-samples/pdf"
DB = os.environ.get("HOSO_DEV_DB", "hoso_dev")
uploaded: list[dict] = []


def sql(query: str) -> str:
    out = subprocess.run(["psql", "-h", "127.0.0.1", "-U", "quoc", "-d", DB, "-Atc", query], capture_output=True, text=True)
    if out.returncode:
        raise RuntimeError(out.stderr)
    return out.stdout.strip()


def login(api: Api):
    api.get("/api/v1/auth/dev-login?username=dev_admin&returnUrl=/")
    _, me = api.get("/api/v1/me")
    api.assignment = next(a["id"] for a in me["assignments"] if a["role"] == "employee")


def upload(api: Api, name: str) -> dict:
    body, ctype = flow.multipart(f"edge-{name}.pdf", (SAMPLES / f"{name}.pdf").read_bytes() + f"\n% edge {uuid.uuid4()}\n".encode())
    status, up = api.post("/api/v1/intake/files", raw=body, content_type=ctype)
    assert status == 201, (status, up)
    up["name"] = name
    uploaded.append(up)
    return up


def wait_job(api: Api, job_id: str, timeout: int = 300, until=("completed", "failed", "cancelled")) -> dict:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        status, job = api.get(f"/api/v1/jobs/{job_id}")
        if status == 200 and job["status"] in until:
            return job
        time.sleep(2)
    return api.get(f"/api/v1/jobs/{job_id}")[1]


def page_methods(job_id: str) -> dict:
    rows = sql(f"SELECT method || ':' || status, count(*) FROM hoso.ocr_pages WHERE job_id = '{job_id}' GROUP BY 1 ORDER BY 1")
    return {line.split("|")[0]: int(line.split("|")[1]) for line in rows.splitlines() if line}


def model_version(job_id: str) -> str:
    return sql(f"SELECT model_version FROM hoso.ocr_jobs WHERE id = '{job_id}'")


def review(api: Api, document_id: str) -> dict:
    status, body = api.get(f"/api/v1/documents/{document_id}/review")
    return body if status == 200 else {}


def timed(job: dict) -> float:
    if not (job.get("startedAt") and job.get("finishedAt")):
        return -1
    from datetime import datetime
    parse = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))
    return (parse(job["finishedAt"]) - parse(job["startedAt"])).total_seconds()


# ---------------------------------------------------------------------------------------------------------------------- kịch bản

def scenario_text(api: Api):
    step("text: PDF có lớp chữ sạch (citizen-land-contract, 3 trang)")
    up = upload(api, "citizen-land-contract")
    api.post(f"/api/v1/documents/{up['documentId']}/ai/extract")
    job = wait_job(api, up["jobId"])
    methods = page_methods(up["jobId"])
    print(f"  {timed(job):.0f} giây · trang: {methods} · {model_version(up['jobId'])}")
    check(job["status"] == "completed", "đọc xong", job.get("error") or job["status"])
    check(set(methods) == {"pdf_text:completed"}, "cả 3 trang lấy từ lớp chữ, không OCR", str(methods))
    check("ocr=" not in model_version(up["jobId"]), "model_version không ghi OCR vì không dùng OCR")
    r = review(api, up["documentId"])
    s = r.get("suggestion") or {}
    print(f"  AI gợi ý: nhóm {s.get('workGroupCode')} loại {s.get('documentTypeCode')} (mẫu U15-D14) · {sum(1 for f in r.get('fields', []) if f.get('suggestedValue'))}/{len(r.get('fields', []))} trường có giá trị")
    check(s.get("workGroupCode") == "U15", "đúng nhóm đất đai (U15)", str(s.get("workGroupCode")))
    return up


def scenario_mixed(api: Api):
    step("mixed: lớp chữ lẫn trang quét (citizen-vehicle-contract, 8 trang, 1 trang là ảnh)")
    up = upload(api, "citizen-vehicle-contract")
    api.post(f"/api/v1/documents/{up['documentId']}/ai/extract")
    job = wait_job(api, up["jobId"])
    methods = page_methods(up["jobId"])
    print(f"  {timed(job):.0f} giây · trang: {methods}")
    check(job["status"] == "completed", "đọc xong", job.get("error") or job["status"])
    check(methods.get("ocr:completed", 0) <= 2 and methods.get("pdf_text:completed", 0) >= 6, "chỉ OCR trang ảnh, còn lại lấy từ lớp chữ", str(methods))
    s = (review(api, up["documentId"]).get("suggestion") or {})
    print(f"  AI gợi ý: nhóm {s.get('workGroupCode')} loại {s.get('documentTypeCode')} (mẫu U27-D14)")


def scenario_packet(api: Api):
    step("packet: gói quét 7 trang gồm nhiều giấy tờ (citizen-mixed-packet)")
    up = upload(api, "citizen-mixed-packet")
    api.post(f"/api/v1/documents/{up['documentId']}/ai/extract")
    job = wait_job(api, up["jobId"], 400)
    print(f"  {timed(job):.0f} giây · trang: {page_methods(up['jobId'])}")
    check(job["status"] == "completed", "đọc xong", job.get("error") or job["status"])
    r = review(api, up["documentId"])
    s = r.get("suggestion") or {}
    print(f"  AI gợi ý: nhóm {s.get('workGroupCode')} loại {s.get('documentTypeCode')} · mixedDocuments={s.get('mixedDocuments')} · hình thức: {s.get('documentForm')}")
    check(s.get("mixedDocuments") is True, "AI báo gói này có nhiều giấy tờ cần tách (gói mẫu gồm đất đai, thừa kế, xe)", f"mixedDocuments={s.get('mixedDocuments')}")
    status, seg = api.get(f"/api/v1/documents/{up['documentId']}/segments")
    check(status == 200, "mở được đề xuất tách văn bản", f"HTTP {status}")


def scenario_handsim(api: Api):
    step("handsim: biểu mẫu điền tay mô phỏng có đáp án (citizen-vehicle-hand-sim)")
    truth = json.loads((ROOT / "data/citizen-samples/ground-truth.json").read_text(encoding="utf-8"))["citizen-vehicle-hand-sim"]["expected_fields"]
    up = upload(api, "citizen-vehicle-hand-sim")
    api.post(f"/api/v1/documents/{up['documentId']}/ai/extract")
    job = wait_job(api, up["jobId"])
    r = review(api, up["documentId"])
    s = r.get("suggestion") or {}
    got = {f["label"]: (f.get("suggestedValue") or "") for f in r.get("fields", [])}
    norm = lambda v: " ".join(str(v).casefold().split())
    right = sum(1 for k, v in truth.items() if norm(got.get(k, "")) == norm(v))
    wrong = sum(1 for k, v in truth.items() if got.get(k) and norm(got[k]) != norm(v))
    print(f"  {timed(job):.0f} giây · nhóm {s.get('workGroupCode')} loại {s.get('documentTypeCode')} (mẫu U27-D13) · trường đúng {right}/{len(truth)}, sai {wrong}, bỏ trống {len(truth) - right - wrong}")
    for k, v in truth.items():
        mark = "✓" if norm(got.get(k, "")) == norm(v) else ("✗" if got.get(k) else "·")
        print(f"    {mark} {k}: mẫu={v!r} AI={got.get(k, '')!r}")
    check(job["status"] == "completed", "đọc xong", job.get("error") or job["status"])
    check(s.get("documentTypeCode") == "U27-D13", "đúng loại giấy khai thu hồi xe (U27-D13)", str(s.get("documentTypeCode")))
    check(right >= 6 and wrong <= 2, "đúng ít nhất 6/9 trường, sai tối đa 2 (chuẩn của bản 4B trên mẫu này: 7/9)", f"đúng {right}, sai {wrong}")


def scenario_reread(api: Api, base: dict):
    step("reread: đọc lại trang 2 của giấy tờ ở kịch bản text")
    before = sql(f"SELECT count(*) FROM hoso.ai_suggestions WHERE document_id = '{base['documentId']}'")
    status, retry = api.post(f"/api/v1/jobs/{base['jobId']}/pages/2/retry")
    if not check(status == 200, "tạo việc đọc lại", f"HTTP {status}: {retry}"):
        return
    job = wait_job(api, retry["id"])
    methods = page_methods(base["jobId"])
    print(f"  {timed(job):.0f} giây · trang của việc gốc sau khi đọc lại: {methods}")
    check(job["status"] == "completed", "việc đọc lại xong", job.get("error") or job["status"])
    check(methods.get("ocr:completed") == 1, "trang 2 đã đọc lại bằng OCR, các trang khác giữ nguyên", str(methods))
    check(sql(f"SELECT count(*) FROM hoso.ai_suggestions WHERE document_id = '{base['documentId']}'") == before, "không tạo gợi ý mới (classify=false)")


def scenario_force(api: Api, base: dict):
    step("force: Trích xuất lại giấy tờ đã đọc xong (reclassify)")
    status, res = api.post(f"/api/v1/documents/{base['documentId']}/ai/extract", {"force": True})
    item = res["items"][0] if status == 200 else {}
    check(status == 200 and item.get("outcome") == "created", "tạo việc gợi ý lại", f"HTTP {status} {item}")
    job = wait_job(api, item["jobId"])
    jtype = sql(f"SELECT job_type FROM hoso.ocr_jobs WHERE id = '{item['jobId']}'")
    print(f"  {timed(job):.0f} giây · {jtype} · {model_version(item['jobId'])} · gợi ý hiện có: {sql(chr(83)+'ELECT count(*) FROM hoso.ai_suggestions WHERE document_id = ' + chr(39) + base['documentId'] + chr(39))}")
    check(job["status"] == "completed" and jtype == "reclassify", "việc reclassify xong", f"{job['status']} {jtype}")
    # Đếm trang OCR của CHÍNH việc này trong nhật ký worker. Không dùng model_version: nó ghi mô hình đã đọc ra chữ đang dùng,
    # nên có "ocr=" khi kịch bản reread chạy trước đã OCR lại một trang của giấy tờ này.
    done = [json.loads(l) for l in (ROOT / "data/dev-run/worker.log").read_text(encoding="utf-8").splitlines() if '"job_completed"' in l and item["jobId"] in l]
    check(bool(done) and done[-1].get("pages_ocr") == 0, "không OCR lại", f"pages_ocr={done[-1].get('pages_ocr') if done else 'không thấy trong nhật ký'}")
    check(int(sql(f"SELECT count(*) FROM hoso.ai_suggestions WHERE document_id = '{base['documentId']}'")) == 2, "có thêm một gợi ý mới (gợi ý cũ giữ lại làm lịch sử)")


def worker_health() -> dict:
    """/health của worker; {} khi không trả lời."""
    out = subprocess.run(["curl", "-s", "--max-time", "3", "http://127.0.0.1:9108/health"], capture_output=True, text=True).stdout
    try:
        return json.loads(out)
    except ValueError:
        return {}


def worker_process() -> int:
    """PID tiến trình Python của worker. data/dev-run/worker.pid là pid của supervise.sh (dev-up.sh chạy worker qua nó):
    giết supervise.sh thì worker thật mồ côi sống tiếp và kịch bản crash không thử được gì. Tìm worker trong nhóm tiến trình của supervise.sh."""
    supervisor = int((ROOT / "data/dev-run/worker.pid").read_text())
    found = subprocess.run(["pgrep", "-g", str(supervisor), "-f", "hoso_ai run"], capture_output=True, text=True).stdout.split()
    if len(found) != 1:
        raise RuntimeError(f"Không xác định được tiến trình worker trong nhóm {supervisor}: {found or 'không thấy'} (chạy bằng scripts/dev-up.sh start chưa?)")
    return int(found[0])


def scenario_cancel(api: Api):
    step("cancel: hủy việc đang chạy và việc đang chờ")
    first, second = upload(api, "citizen-mixed-packet"), upload(api, "citizen-vehicle-hand-sim")
    running = wait_job(api, first["jobId"], 60, until=("running",))
    print(f"  việc 1: {running['status']} · stage {running.get('stage')}")
    status, queued_cancel = api.post(f"/api/v1/jobs/{second['jobId']}/cancel")
    check(status == 200 and queued_cancel["status"] == "cancelled", "hủy việc đang chờ", f"HTTP {status}")
    status, run_cancel = api.post(f"/api/v1/jobs/{first['jobId']}/cancel")
    check(status == 200 and run_cancel["status"] == "cancelled", "hủy việc đang chạy", f"HTTP {status} {run_cancel.get('status') if isinstance(run_cancel, dict) else run_cancel}")
    # Worker thấy lệnh hủy ở mốc kế tiếp của pipeline (xong một trang, trước bước phân loại), không phải ngay lập tức:
    # với Ollama một trang OCR mất 5–30 giây, nên chờ tới 90 giây và in độ trễ thật thay vì một ngưỡng cứng.
    cancelled, started = {first["jobId"], second["jobId"]}, time.monotonic()
    health = worker_health()
    while time.monotonic() - started < 90 and health.get("currentJob") in cancelled:
        time.sleep(1)
        health = worker_health()
    print(f"  worker bỏ việc đã hủy sau {time.monotonic() - started:.0f} giây")
    check(bool(health) and health.get("currentJob") not in cancelled, "worker dừng việc đã hủy và trở về rảnh", str(health) or "worker không trả lời /health")
    check(sql(f"SELECT count(*) FROM hoso.ai_suggestions WHERE document_id IN ('{first['documentId']}','{second['documentId']}')") == "0", "việc hủy không để lại gợi ý nào")
    print(f"  trạng thái cuối: việc 1={sql(chr(83)+'ELECT status FROM hoso.ocr_jobs WHERE id = ' + chr(39) + first['jobId'] + chr(39))}, việc 2={sql(chr(83)+'ELECT status FROM hoso.ocr_jobs WHERE id = ' + chr(39) + second['jobId'] + chr(39))}")


def scenario_crash(api: Api):
    step("crash: giết worker khi đang đọc gói 7 trang, rồi để hệ thống thu hồi")
    up = upload(api, "citizen-mixed-packet")
    api.post(f"/api/v1/documents/{up['documentId']}/ai/extract")
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline and int(sql(f"SELECT count(*) FROM hoso.ocr_pages WHERE job_id = '{up['jobId']}'") or 0) < 2:
        time.sleep(1)
    done_before = int(sql(f"SELECT count(*) FROM hoso.ocr_pages WHERE job_id = '{up['jobId']}'"))
    old_worker = worker_health().get("worker")
    pid = worker_process()
    os.kill(pid, signal.SIGKILL)
    print(f"  đã giết worker (pid {pid}) khi xong {done_before}/7 trang")
    time.sleep(2)
    check(sql(f"SELECT status FROM hoso.ocr_jobs WHERE id = '{up['jobId']}'") == "running", "việc còn ghi là đang chạy (chưa ai biết worker chết)")
    dead_lock = sql(f"SELECT locked_by FROM hoso.ocr_jobs WHERE id = '{up['jobId']}'")
    sql(f"UPDATE hoso.ocr_jobs SET heartbeat_at = now() - interval '10 minutes' WHERE id = '{up['jobId']}'")     # mô phỏng đã mất nhịp sống quá 5 phút
    # Thu hồi xong khi việc không còn gắn với worker đã chết: đang chờ, hoặc worker mới (supervise.sh chạy lại sau ~5 giây) đã nhận ngay.
    started = time.monotonic()
    while time.monotonic() - started < 150 and sql(f"SELECT status = 'running' AND locked_by = '{dead_lock}' FROM hoso.ocr_jobs WHERE id = '{up['jobId']}'") == "t":
        time.sleep(1)
    status_now = sql(f"SELECT status || ' attempt=' || attempt || ' worker=' || coalesce(locked_by, '-') FROM hoso.ocr_jobs WHERE id = '{up['jobId']}'")
    print(f"  sau {time.monotonic() - started:.0f} giây: {status_now}")
    check(status_now.startswith("queued") or (status_now.startswith("running") and not status_now.endswith(f"worker={dead_lock}")),
          "API thu hồi việc của worker đã chết (StaleJobReaper chạy mỗi phút)", status_now)
    subprocess.run([str(ROOT / "scripts/dev-up.sh"), "start"], capture_output=True)     # supervise.sh thường đã tự chạy lại worker; lệnh này khi đó không làm gì
    job = wait_job(api, up["jobId"], 400)
    new_worker = worker_health().get("worker")
    check(new_worker is not None and new_worker != old_worker, "worker mới đã chạy thay worker bị giết", f"trước {old_worker}, sau {new_worker}")
    log = [json.loads(l) for l in (ROOT / "data/dev-run/worker.log").read_text(encoding="utf-8").splitlines() if '"job_completed"' in l and up["jobId"] in l]
    redone = log[-1]["pages_ocr"] if log else None
    print(f"  worker mới đọc {redone} trang (đã có {done_before} trước khi chết) · trạng thái cuối {job['status']}")
    check(job["status"] == "completed", "việc chạy tiếp và xong", job.get("error") or job["status"])
    check(redone is not None and redone <= 7 - done_before, "chỉ đọc các trang còn thiếu, không đọc lại từ đầu", f"đọc lại {redone} trang")


SCENARIOS = ["text", "mixed", "packet", "handsim", "reread", "force", "cancel", "crash"]


def main() -> int:
    wanted = sys.argv[1:] or SCENARIOS
    api = Api("http://localhost:5080")
    login(api)
    base = None
    for name in SCENARIOS:
        if name not in wanted:
            continue
        try:
            if name == "text":
                base = scenario_text(api)
            elif name in ("reread", "force"):
                base = base or upload_done_text(api)
                (scenario_reread if name == "reread" else scenario_force)(api, base)
            else:
                globals()[f"scenario_{name}"](api)
        except Exception as error:      # một kịch bản hỏng không chặn các kịch bản sau
            check(False, f"kịch bản {name} chạy được", f"{type(error).__name__}: {error}")
    step("Dọn: bỏ các giấy tờ thử khỏi hộp tiếp nhận")
    for up in uploaded:
        api.post(f"/api/v1/intake/documents/{up['documentId']}/discard")
    print(f"  đã bỏ {len(uploaded)} giấy tờ")
    print(f"\n{len(flow.failures)} kiểm tra hỏng")
    for message in flow.failures:
        print(f"  ✗ {message}")
    return 1 if flow.failures else 0


def upload_done_text(api: Api) -> dict:
    up = upload(api, "citizen-land-contract")
    api.post(f"/api/v1/documents/{up['documentId']}/ai/extract")
    wait_job(api, up["jobId"])
    return up


if __name__ == "__main__":
    sys.exit(main())
