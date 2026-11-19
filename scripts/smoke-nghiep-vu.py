#!/usr/bin/env python3
"""QA-02. Thông luồng NGHIỆP VỤ theo vai trò, qua web thật (cổng 3000 chuyển tiếp /api/* sang API), mỗi bước bằng ĐÚNG người của bước đó
(tài khoản giả lập của backend/scripts/seed-dev-accounts.sh). Kịch bản theo nghiep-vu-vai-tro.html mục "Kịch bản thử trên giao diện":

  1. Luồng B (hồ sơ đang xử lý): chuyên viên Hạ tầng nạp PDF, AI đọc, đối chiếu, lập hồ sơ, trình → trưởng phòng Hạ tầng giao Chuyên viên 02,
     kiểm tra đạt → văn thư UBND đặt vị trí kho, lập đợt nộp lưu, nộp, tiếp nhận → chuyên viên mượn, văn thư duyệt, giao, nhận trả
     → trưởng phòng xuất gói ZIP. Kèm: thông báo tới người nhận việc, người ngoài phòng không mở được.
  2. Trả bổ sung và trình lãnh đạo: trưởng phòng trả lại (ghi lý do) → chuyên viên trình lại → trưởng phòng trình lãnh đạo → Chủ tịch trả
     lại → trình lại → Chủ tịch cho ý kiến → văn thư lưu trữ trực tiếp.
  3. Luồng A (số hóa hồ sơ giấy đã kết thúc) ở Phòng Kinh tế: trình → trưởng phòng đạt → văn thư trả lại → trình lại → đạt → lưu trữ.
  4. Luồng C (HĐND): chuyên viên Ban Kinh tế - Ngân sách → Trưởng Ban trình → lãnh đạo HĐND cho ý kiến → văn thư HĐND lưu trữ.
  5. Lô quét: văn thư mở lô, nạp PDF vào lô, đóng lô.
  6. Ủy quyền: quản trị ủy quyền quyền giao việc của trưởng phòng cho Chuyên viên 02 một ngày, rồi thu hồi.
  7. Mỗi vai trò mở được mọi trang trong menu của mình (trang render ở máy chủ, không lỗi).

    python3 scripts/smoke-nghiep-vu.py                 # tất cả (khoảng 6–10 phút: AI đọc 4 PDF qua máy AI)
    python3 scripts/smoke-nghiep-vu.py pages scan      # chọn kịch bản: main return digitize council scan delegation pages

Cần: scripts/dev-up.sh start (API ở Development), worker AI chạy, tài khoản thử đã nạp. Dữ liệu thử có tiêu đề "THỬ NGHIỆP VỤ <mã lượt>"
và nằm lại trong CSDL dev (hồ sơ đã lưu trữ, vị trí kho "THU-…", đợt nộp lưu, lượt mượn, gói xuất). Mã thoát 1 khi có kiểm tra hỏng.
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("smoke_ai_flow", ROOT / "scripts/smoke-ai-flow.py")
flow = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(flow)
check, step, failures = flow.check, flow.step, flow.failures

WEB = "http://localhost:3000"
SAMPLE = ROOT / "data/citizen-samples/pdf/citizen-land-contract.pdf"     # có lớp chữ: AI không cần OCR nên nhanh
RUN = uuid.uuid4().hex[:6].upper()
TODAY = dt.date.today()


# ---- người dùng ----------------------------------------------------------------------------------------------

class User(flow.Api):
    """Một người đăng nhập dev; phân công đầu tiên (tài khoản thử chỉ có một) là phân công đang dùng."""

    def __init__(self, username: str):
        super().__init__(WEB)
        self.username = username
        status, _ = self.get(f"/api/v1/auth/dev-login?username={urllib.parse.quote(username)}&returnUrl=/")
        if status not in (200, 302):
            raise RuntimeError(f"Không đăng nhập được {username} (HTTP {status}). Đã chạy backend/scripts/seed-dev-accounts.sh --apply chưa?")
        _, self.me = self.get("/api/v1/me")
        self.assignment = self.me["assignments"][0]["id"]
        self.user_id = self.me.get("id") or self.me.get("user", {}).get("id")

    def page(self, path: str) -> tuple[int, str]:
        """Trang render ở máy chủ, như trình duyệt mở (cookie phiên + cookie phân công). Trả (mã, chữ đã bỏ thẻ)."""
        cookies = "; ".join(f"{c.name}={c.value}" for c in self.jar) + f"; hoso_assignment={self.assignment}"
        req = urllib.request.Request(WEB + path, headers={"Accept": "text/html", "Cookie": cookies})
        try:
            with urllib.request.build_opener(flow.NoRedirect).open(req, timeout=180) as response:
                html = response.read().decode(errors="replace").replace("<!-- -->", "")
                return response.status, re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html))
        except urllib.error.HTTPError as error:
            return error.code, ""


_users: dict[str, User] = {}


def as_(username: str) -> User:
    if username not in _users:
        _users[username] = User(username)
    return _users[username]


def download(user: User, path: str) -> bytes:
    """Tệp nhị phân (PDF, ZIP); b"" khi lỗi."""
    req = urllib.request.Request(WEB + path, headers={"X-Assignment-Id": user.assignment})
    try:
        with user.opener.open(req, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError:
        return b""


def problem(body) -> str:
    return (body.get("detail") or body.get("title") or json.dumps(body, ensure_ascii=False)[:200]) if isinstance(body, dict) else str(body)[:200]


# ---- giấy tờ: nạp, AI đọc, đối chiếu --------------------------------------------------------------------------

def upload(user: User, label: str, batch_id: str | None = None) -> dict:
    body, ctype = flow.multipart(f"thu-nghiep-vu-{label}-{RUN}.pdf", SAMPLE.read_bytes() + f"\n% nghiep-vu {RUN} {label} {uuid.uuid4()}\n".encode())
    if batch_id:     # trường batchId của form đứng trước tệp
        boundary = ctype.split("boundary=", 1)[1]
        body = f'--{boundary}\r\nContent-Disposition: form-data; name="batchId"\r\n\r\n{batch_id}\r\n'.encode() + body
    status, up = user.post("/api/v1/intake/files", raw=body, content_type=ctype)
    if not check(status == 201, f"{user.username} nạp PDF ({label})", f"HTTP {status}: {problem(up)}"):
        raise RuntimeError("không nạp được PDF")
    user.post(f"/api/v1/documents/{up['documentId']}/ai/extract")      # Trích xuất ngay: lên đầu hàng đợi AI
    return {**up, "label": label, "owner": user.username}


def wait_read(docs: list[dict], timeout: int = 900) -> None:
    started, pending = time.monotonic(), {d["jobId"]: d for d in docs}
    while pending and time.monotonic() - started < timeout:
        for job_id, d in list(pending.items()):
            _, job = as_(d["owner"]).get(f"/api/v1/jobs/{job_id}")
            if job.get("status") in ("completed", "failed", "cancelled"):
                d["job"] = job
                del pending[job_id]
        time.sleep(4)
    for d in docs:
        status = d.get("job", {}).get("status", f"chưa xong sau {timeout} giây")
        check(status == "completed", f"AI đọc xong PDF {d['label']} của {d['owner']}", status)


def groups_in_scope(user: User) -> list[str]:
    a = user.me["assignments"][0]
    query = urllib.parse.urlencode({k: v for k, v in (("organization", a.get("organizationCode")), ("department", a.get("departmentCode"))) if v})
    _, groups = user.get(f"/api/v1/catalog/work-groups?{query}")
    return [g["code"] for g in groups] if isinstance(groups, list) else []


def review_and_verify(user: User, doc: dict, group: str) -> bool:
    """Đối chiếu như cán bộ trên màn đối chiếu: nhận loại AI gợi ý nếu thuộc nhóm của hồ sơ (không thì chọn loại đầu của nhóm),
    nhận giá trị AI gợi ý, xác nhận các trường còn lại để trống, rồi đánh dấu đã đối chiếu."""
    doc_id = doc["documentId"]
    _, review = user.get(f"/api/v1/documents/{doc_id}/review")
    suggestion = review.get("suggestion") or {}
    doc["aiType"] = f"{suggestion.get('workGroupCode')}/{suggestion.get('documentTypeCode')}"
    doc["aiFields"] = sum(1 for f in review.get("fields", []) if f.get("suggestedValue"))
    type_code = suggestion.get("documentTypeCode") if suggestion.get("workGroupCode") == group else None
    if not type_code:
        _, types = user.get(f"/api/v1/catalog/work-groups/{group}/document-types")
        type_code = types[0]["code"] if isinstance(types, list) and types else None
    status, classified = user.request("PUT", f"/api/v1/documents/{doc_id}/classification", body={"workGroupCode": group, "documentTypeCode": type_code})
    if not check(status == 200, f"{user.username} xác nhận phân loại {group}/{type_code}", f"HTTP {status}: {problem(classified)}"):
        return False
    fields = classified.get("fields") if isinstance(classified, dict) and classified.get("fields") else user.get(f"/api/v1/documents/{doc_id}/review")[1].get("fields", [])
    values = [{"fieldCode": f["fieldCode"], "value": f.get("value") or f.get("suggestedValue"), "verify": True} for f in fields if not f.get("verified")]
    status, body = user.request("PATCH", f"/api/v1/documents/{doc_id}/fields", body={"fields": values})
    if status != 200:      # giá trị AI sai kiểu (ngày…): cán bộ sẽ sửa; ở đây để trống
        status, body = user.request("PATCH", f"/api/v1/documents/{doc_id}/fields", body={"fields": [{**v, "value": None} for v in values]})
    check(status == 200, f"{user.username} xác nhận {len(values)} trường", f"HTTP {status}: {problem(body)}")
    status, body = user.post(f"/api/v1/documents/{doc_id}/verify")
    return check(status == 200, f"{user.username} đánh dấu giấy tờ đã đối chiếu", f"HTTP {status}: {problem(body)}")


# ---- hồ sơ ---------------------------------------------------------------------------------------------------

def create_dossier(user: User, title: str, group: str, workflow: str, doc: dict) -> dict | None:
    status, dossier = user.post("/api/v1/dossiers", {"title": f"THỬ NGHIỆP VỤ {RUN} · {title}", "workGroupCode": group, "workflowCode": workflow})
    if not check(status == 201, f"{user.username} lập hồ sơ {workflow} nhóm {group}", f"HTTP {status}: {problem(dossier)}"):
        return None
    status, body = user.post(f"/api/v1/dossiers/{dossier['id']}/documents", {"documentId": doc["documentId"], "direction": "internal"})
    check(status == 200, f"{user.username} xếp giấy tờ vào hồ sơ {dossier['code']}", f"HTTP {status}: {problem(body)}")
    print(f"  hồ sơ {dossier['code']}")
    return dossier


def enabled_actions(user: User, dossier: dict) -> set[str]:
    status, actions = user.get(f"/api/v1/dossiers/{dossier['id']}/actions")
    return {a["action"] for a in actions if a.get("enabled")} if status == 200 and isinstance(actions, list) else set()


def act(user: User, dossier: dict, action: str, note: str | None = None, expect_status: str | None = None) -> bool:
    """Chuyển bước như bấm nút: nút phải đang bật cho đúng người, gửi kèm phiên bản hiện tại."""
    allowed = enabled_actions(user, dossier)
    check(action in allowed, f"{user.username} thấy nút {action}", f"các nút đang bật: {sorted(allowed)}")
    _, detail = user.get(f"/api/v1/dossiers/{dossier['id']}")
    status, body = user.post(f"/api/v1/dossiers/{dossier['id']}/transitions", {"action": action, "note": note, "version": detail.get("version")})
    ok = check(status == 200, f"{user.username} {action}" + (f" → {expect_status}" if expect_status else ""), f"HTTP {status}: {problem(body)}")
    if ok and expect_status:
        _, detail = user.get(f"/api/v1/dossiers/{dossier['id']}")
        ok = check(detail.get("status") == expect_status, f"hồ sơ ở bước {expect_status}", f"đang là {detail.get('status')}")
    return ok


def in_queue(user: User, dossier: dict) -> bool:
    _, queue = user.get("/api/v1/workspace/queue")
    return dossier["code"] in json.dumps(queue, ensure_ascii=False)


def notified(user: User, dossier: dict, kind: str | None = None, timeout: float = 20) -> bool:
    """Thông báo đi qua outbox (gửi nền, trễ vài giây) nên chờ tới `timeout` giây."""
    deadline = time.monotonic() + timeout
    while True:
        _, notes = user.get("/api/v1/notifications?limit=50")
        items = notes.get("items", []) if isinstance(notes, dict) else []
        if any(n.get("dossierId") == dossier["id"] and (kind is None or n.get("kind") == kind) for n in items):
            return True
        if time.monotonic() > deadline:
            return False
        time.sleep(1)


def cannot_open(user: User, dossier: dict, why: str) -> None:
    status, _ = user.get(f"/api/v1/dossiers/{dossier['id']}")
    check(status in (403, 404), f"{user.username} không mở được hồ sơ ({why})", f"HTTP {status}")


def page_ok(user: User, path: str, label: str) -> None:
    status, text = user.page(path)
    broken = next((m for m in ("Chưa tải được", "Application error", "Unhandled Runtime Error", "Đã xảy ra lỗi") if m in text), None)
    check(status == 200 and not broken, f"{user.username} mở trang {label}", f"HTTP {status} {broken or ''}")


# ---- kịch bản ------------------------------------------------------------------------------------------------

def scenario_main(docs: dict) -> dict | None:
    step("1. Luồng B: chuyên viên → trưởng phòng (giao Chuyên viên 02, kiểm tra đạt) → văn thư (kho, nộp lưu) → mượn trả → xuất gói")
    cv, head, cv2, clerk = as_("demo_cv_ht"), as_("demo_head_ht"), as_("demo_cv_ht_02"), as_("demo_clerk_ubnd")
    group = groups_in_scope(cv)[0] if "U15" not in groups_in_scope(cv) else "U15"
    if not review_and_verify(cv, docs["main"], group):
        return None
    dossier = create_dossier(cv, "Luồng B chính", group, "in_progress", docs["main"])
    if not dossier:
        return None
    page_ok(cv, f"/ho-so/{dossier['id']}", "chi tiết hồ sơ (chuyên viên)")
    act(cv, dossier, "submit", expect_status="department_review")
    check(in_queue(head, dossier), "trưởng phòng Hạ tầng thấy hồ sơ trong hàng việc")
    check(notified(head, dossier, "dossier.awaiting_review"), "trưởng phòng nhận thông báo có hồ sơ trình")
    check(not enabled_actions(cv, dossier), "chuyên viên không còn nút chuyển bước khi hồ sơ đã trình", str(enabled_actions(cv, dossier)))
    cannot_open(as_("demo_head_kt"), dossier, "trưởng phòng Kinh tế, phòng khác")
    cannot_open(as_("demo_cv_bkt"), dossier, "chuyên viên Ban HĐND")
    page_ok(head, f"/ho-so/{dossier['id']}", "chi tiết hồ sơ (trưởng phòng)")

    status, assignees = head.get(f"/api/v1/dossiers/{dossier['id']}/assignees")
    target = next((a for a in assignees if "cv_ht_02" in json.dumps(a)), None) if isinstance(assignees, list) else None
    if check(target is not None, "danh sách người được giao có Chuyên viên 02", f"HTTP {status}: {json.dumps(assignees, ensure_ascii=False)[:200]}"):
        user_id = target.get("userId") or target.get("id")
        status, body = head.request("PUT", f"/api/v1/dossiers/{dossier['id']}/assignment",
                                    body={"userId": user_id, "dueOn": (TODAY + dt.timedelta(days=7)).isoformat(), "note": "Giao thử"})
        check(status == 200, "trưởng phòng giao Chuyên viên 02 chủ trì, hạn 7 ngày", f"HTTP {status}: {problem(body)}")
        # Hàng việc của chuyên viên chỉ có hồ sơ ở bước nháp hoặc bị trả lại (việc họ phải làm); đang chờ trưởng phòng thì chưa có.
        status, _ = cv2.get(f"/api/v1/dossiers/{dossier['id']}")
        check(status == 200, "Chuyên viên 02 mở được hồ sơ mình được giao", f"HTTP {status}")
        check(notified(cv2, dossier, "dossier.assigned"), "Chuyên viên 02 nhận thông báo được giao")
        # Luật phạm vi (029): chuyên viên chỉ thấy hồ sơ mình chủ trì hoặc phối hợp; giao chủ trì cho người khác thì người lập không còn xem.
        cannot_open(cv, dossier, "chuyên viên lập hồ sơ, đã giao chủ trì cho Chuyên viên 02")
        cv = cv2
    act(head, dossier, "accept", expect_status="ready_archive")
    check(in_queue(clerk, dossier), "văn thư UBND thấy hồ sơ chờ nộp lưu")

    # Văn thư: vị trí kho (kho › hộp), đặt hồ sơ vào hộp, lập đợt nộp lưu, nộp, tiếp nhận.
    status, warehouse = clerk.post("/api/v1/storage-locations", {"parentId": None, "kind": "warehouse", "code": f"THU-{RUN}", "name": f"Kho thử {RUN}", "capacityNote": None})
    box = None
    if check(status in (200, 201), "văn thư thêm kho", f"HTTP {status}: {problem(warehouse)}"):
        status, box = clerk.post("/api/v1/storage-locations", {"parentId": warehouse["id"], "kind": "box", "code": f"THU-{RUN}-H1", "name": "Hộp 1", "capacityNote": None})
        check(status in (200, 201), "văn thư thêm hộp trong kho", f"HTTP {status}: {problem(box)}")
    if box:
        status, body = clerk.request("PUT", f"/api/v1/dossiers/{dossier['id']}/location", body={"locationId": box["id"], "note": "Đặt thử"})
        check(status == 200, "văn thư đặt hồ sơ vào hộp", f"HTTP {status}: {problem(body)}")
    status, submission = clerk.post("/api/v1/archive-submissions", {"dossierIds": [dossier["id"]], "note": f"Đợt thử {RUN}"})
    if check(status in (200, 201), "văn thư lập đợt nộp lưu", f"HTTP {status}: {problem(submission)}"):
        status, body = clerk.post(f"/api/v1/archive-submissions/{submission['id']}/submit")
        check(status == 200, "văn thư nộp đợt", f"HTTP {status}: {problem(body)}")
        status, body = clerk.post(f"/api/v1/archive-submissions/{submission['id']}/receive")
        check(status == 200, "văn thư tiếp nhận đợt", f"HTTP {status}: {problem(body)}")
        data = download(clerk, f"/api/v1/archive-submissions/{submission['id']}/minutes")
        check(data[:5] == b"%PDF-", f"tải biên bản nộp lưu (PDF, {len(data):,} byte)")
    _, detail = cv.get(f"/api/v1/dossiers/{dossier['id']}")
    check(detail.get("status") == "archived", "hồ sơ đã lưu trữ", f"đang là {detail.get('status')}")
    edit = {"version": detail.get("version"), "title": "sửa sau lưu trữ", "notes": detail.get("notes"), "internalDueOn": detail.get("dueOn"),
            "accessLevel": detail.get("accessLevel"), "physicalLocation": detail.get("physicalLocation"), "procedureId": detail.get("procedureId")}
    status, body = cv.request("PATCH", f"/api/v1/dossiers/{dossier['id']}", body=edit)
    check(status in (403, 409, 422), "hồ sơ đã lưu trữ bị khóa sửa", f"HTTP {status}: {problem(body)}")

    # Mượn trả bản giấy.
    status, loan = cv.post("/api/v1/loans", {"dossierId": dossier["id"], "purpose": "Đối chiếu bản giấy (thử)", "dueOn": (TODAY + dt.timedelta(days=10)).isoformat()})
    if check(status in (200, 201), "chuyên viên đề nghị mượn bản giấy", f"HTTP {status}: {problem(loan)}"):
        for verb, label in (("approve", "duyệt"), ("lend", "giao"), ("return", "nhận trả")):
            status, body = clerk.post(f"/api/v1/loans/{loan['id']}/{verb}")
            check(status == 200, f"văn thư {label} lượt mượn", f"HTTP {status}: {problem(body)}")

    # Xuất gói.
    status, export = head.post("/api/v1/exports", {"dossierIds": [dossier["id"]], "status": None, "workGroupCode": None, "archivedFrom": None, "archivedTo": None, "format": "zip_pdf_json"})
    if check(status in (200, 201, 202), "trưởng phòng tạo gói xuất", f"HTTP {status}: {problem(export)}"):
        deadline, state = time.monotonic() + 180, {}
        while time.monotonic() < deadline:
            _, state = head.get(f"/api/v1/exports/{export['id']}")
            if state.get("status") in ("ready", "failed", "expired"):
                break
            time.sleep(2)
        if check(state.get("status") == "ready", "gói xuất sẵn sàng", str(state.get("status"))):
            data = download(head, f"/api/v1/exports/{export['id']}/file")
            check(data[:2] == b"PK" and len(data) > 1000, f"tải gói ZIP ({len(data):,} byte)")
    return dossier


def scenario_return() -> None:
    step("2. Trả bổ sung, trình lãnh đạo, Chủ tịch trả lại rồi cho ý kiến, văn thư lưu trữ")
    cv, head, chair, clerk = as_("demo_cv_ht"), as_("demo_head_ht"), as_("demo_chair"), as_("demo_clerk_ubnd")
    doc = DOCS["return"]
    group = "U15" if "U15" in groups_in_scope(cv) else groups_in_scope(cv)[0]
    if not review_and_verify(cv, doc, group) or not (dossier := create_dossier(cv, "Trả bổ sung và trình lãnh đạo", group, "in_progress", doc)):
        return
    act(cv, dossier, "submit", expect_status="department_review")
    status, body = head.post(f"/api/v1/dossiers/{dossier['id']}/transitions", {"action": "return", "note": None, "version": head.get(f"/api/v1/dossiers/{dossier['id']}")[1].get("version")})
    check(status in (400, 422), "trả lại mà không ghi lý do bị chặn", f"HTTP {status}")
    act(head, dossier, "return", note="Thiếu bản sao giấy chứng nhận, bổ sung giúp.", expect_status="returned")
    check(notified(cv, dossier, "dossier.returned"), "chuyên viên nhận thông báo bị trả lại")
    check(in_queue(cv, dossier), "hồ sơ bị trả lại nằm trong hàng việc của chuyên viên")
    act(cv, dossier, "submit", expect_status="department_review")
    act(head, dossier, "escalate", note="Đề nghị Chủ tịch cho ý kiến về giá chuyển nhượng.", expect_status="leadership_review")
    check(in_queue(chair, dossier), "Chủ tịch thấy hồ sơ trình trong hàng việc")
    check(notified(chair, dossier, "dossier.awaiting_decision"), "Chủ tịch nhận thông báo có hồ sơ trình")
    page_ok(chair, f"/ho-so/{dossier['id']}", "chi tiết hồ sơ (Chủ tịch)")
    cannot_open(as_("demo_council"), dossier, "lãnh đạo HĐND, hồ sơ UBND")
    act(chair, dossier, "return", note="Làm rõ thêm căn cứ pháp lý.", expect_status="department_review")
    act(head, dossier, "escalate", note="Đã bổ sung căn cứ.", expect_status="leadership_review")
    act(chair, dossier, "decide", note="Đồng ý với đề xuất của phòng.", expect_status="ready_archive")
    act(clerk, dossier, "archive", expect_status="archived")
    _, history = cv.get(f"/api/v1/dossiers/{dossier['id']}/history")
    check(isinstance(history, (list, dict)) and len(json.dumps(history)) > 200, "nhật ký xử lý ghi đủ các bước")


def scenario_digitize() -> None:
    step("3. Luồng A (số hóa hồ sơ giấy đã kết thúc) ở Phòng Kinh tế, văn thư trả lại")
    cv, head, clerk = as_("demo_cv_kt"), as_("demo_head_kt"), as_("demo_clerk_ubnd")
    doc = DOCS["digitize"]
    group = groups_in_scope(cv)[0]
    if not review_and_verify(cv, doc, group) or not (dossier := create_dossier(cv, "Số hóa hồ sơ đã kết thúc", group, "digitize_closed", doc)):
        return
    act(cv, dossier, "submit", expect_status="department_review")
    check("escalate" not in enabled_actions(head, dossier), "luồng A không có bước trình lãnh đạo")
    act(head, dossier, "accept", expect_status="ready_archive")
    act(clerk, dossier, "return", note="Ảnh trang 2 mờ, quét lại.", expect_status="returned")
    act(cv, dossier, "submit", expect_status="department_review")
    act(head, dossier, "accept", expect_status="ready_archive")
    act(clerk, dossier, "archive", expect_status="archived")
    cannot_open(as_("demo_head_ht"), dossier, "trưởng phòng Hạ tầng, phòng khác")
    cannot_open(as_("demo_cv_ht"), dossier, "chuyên viên Hạ tầng, phòng khác")


def scenario_council() -> None:
    step("4. Luồng C (HĐND): chuyên viên Ban Kinh tế - Ngân sách → Trưởng Ban → lãnh đạo HĐND → văn thư HĐND")
    cv, head, council, clerk = as_("demo_cv_bkt"), as_("demo_head_bkt"), as_("demo_council"), as_("demo_clerk_hdnd")
    doc = DOCS["council"]
    group = groups_in_scope(cv)[0]
    if not review_and_verify(cv, doc, group) or not (dossier := create_dossier(cv, "Thẩm tra của Ban", group, "council", doc)):
        return
    act(cv, dossier, "submit", expect_status="department_review")
    act(head, dossier, "escalate", note="Trình lãnh đạo HĐND.", expect_status="leadership_review")
    check(in_queue(council, dossier), "lãnh đạo HĐND thấy hồ sơ trình")
    cannot_open(as_("demo_chair"), dossier, "Chủ tịch UBND, hồ sơ HĐND")
    cannot_open(as_("demo_clerk_ubnd"), dossier, "văn thư UBND, hồ sơ HĐND")
    act(council, dossier, "decide", note="Thống nhất báo cáo thẩm tra.", expect_status="ready_archive")
    act(clerk, dossier, "archive", expect_status="archived")


def scenario_scan() -> None:
    step("5. Lô quét: văn thư mở lô, nạp PDF vào lô, đóng lô")
    clerk = as_("demo_clerk_ubnd")
    status, batch = clerk.post("/api/v1/intake/batches", {"organizationCode": "tl-ubnd", "departmentCode": "ht", "handedOverBy": "Phòng Hạ tầng (thử)",
                                                           "boxLabel": f"THU-{RUN}", "expectedSheetCount": 3, "note": "Lô thử"})
    if not check(status in (200, 201), "văn thư mở lô quét", f"HTTP {status}: {problem(batch)}"):
        return
    up = upload(clerk, "lo-quet", batch_id=batch["id"])
    _, detail = clerk.get(f"/api/v1/intake/batches/{batch['id']}")
    check(up["documentId"] in json.dumps(detail), "PDF nằm trong lô", json.dumps(detail, ensure_ascii=False)[:200])
    status, body = clerk.post(f"/api/v1/intake/batches/{batch['id']}/close", {"acceptOpenIssuesNote": None})
    check(status == 200, "văn thư đóng lô", f"HTTP {status}: {problem(body)}")
    page_ok(clerk, f"/tiep-nhan/lo-quet/{batch['id']}", "chi tiết lô quét")
    clerk.post(f"/api/v1/intake/documents/{up['documentId']}/discard")     # không để AI đọc thêm việc thừa vào hộp


def scenario_delegation() -> None:
    step("6. Ủy quyền: quản trị ủy quyền giao việc của trưởng phòng cho Chuyên viên 02 một ngày, rồi thu hồi")
    admin, head, cv2 = as_("demo_admin"), as_("demo_head_ht"), as_("demo_cv_ht_02")
    before = len(cv2.me["assignments"])
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    status, delegation = admin.post("/api/v1/admin/delegations", {
        "fromAssignmentId": head.assignment, "toUserId": cv2.user_id, "permissionCodes": ["dossier.assign"],
        "validFrom": now.isoformat(), "validUntil": (now + dt.timedelta(days=1)).isoformat(), "basis": f"Ủy quyền thử {RUN}"})
    if not check(status in (200, 201), "quản trị tạo ủy quyền", f"HTTP {status}: {problem(delegation)}"):
        return
    fresh = User("demo_cv_ht_02")
    check(len(fresh.me["assignments"]) == before + 1, "Chuyên viên 02 có thêm phân công ủy quyền", f"{before} → {len(fresh.me['assignments'])}")
    status, body = admin.post(f"/api/v1/admin/delegations/{delegation['id']}/revoke")
    check(status in (200, 204), "quản trị thu hồi ủy quyền", f"HTTP {status}: {problem(body)}")
    time.sleep(1)
    after = User("demo_cv_ht_02")
    check(len(after.me["assignments"]) == before, "thu hồi xong thì phân công ủy quyền mất", f"còn {len(after.me['assignments'])}")


ROLE_PAGES = {
    "demo_cv_ht": ["/viec-cua-toi", "/tiep-nhan", "/tiep-nhan/tai-len", "/ho-so", "/ho-so/tao-moi", "/thu-tuc", "/muon-tra", "/tra-cuu", "/thong-bao", "/tai-khoan"],
    "demo_head_ht": ["/viec-cua-toi", "/ho-so", "/muon-tra", "/xuat-du-lieu", "/thong-bao"],
    "demo_clerk_ubnd": ["/viec-cua-toi", "/tiep-nhan", "/tiep-nhan/lo-quet", "/ho-so", "/kho-ban-giay", "/nop-luu", "/muon-tra", "/xuat-du-lieu", "/de-nghi-huy"],
    "demo_chair": ["/viec-cua-toi", "/ho-so", "/xuat-du-lieu", "/de-nghi-huy"],
    "demo_council": ["/viec-cua-toi", "/ho-so", "/xuat-du-lieu", "/de-nghi-huy"],
    "demo_admin": ["/viec-cua-toi", "/quan-tri/nguoi-dung", "/quan-tri/danh-muc", "/quan-tri/van-hanh", "/quan-tri/nhat-ky"],
}


def scenario_pages() -> None:
    step("7. Mỗi vai trò mở các trang trong menu của mình")
    for username, paths in ROLE_PAGES.items():
        user = as_(username)
        for path in paths:
            page_ok(user, path, path)


DOCS: dict[str, dict] = {}
SCENARIOS = ["main", "return", "digitize", "council", "scan", "delegation", "pages"]


def main() -> int:
    wanted = sys.argv[1:] or SCENARIOS
    unknown = [w for w in wanted if w not in SCENARIOS]
    if unknown:
        print(f"Kịch bản không có: {unknown}. Có: {SCENARIOS}", file=sys.stderr)
        return 2
    started = time.monotonic()
    print(f"Lượt {RUN} · {', '.join(wanted)}")
    # Nạp PDF trước cho mọi kịch bản cần giấy tờ, để AI đọc trong lúc chờ (mỗi người nạp vào hộp tiếp nhận của mình).
    owners = {"main": "demo_cv_ht", "return": "demo_cv_ht", "digitize": "demo_cv_kt", "council": "demo_cv_bkt"}
    needed = [k for k in owners if k in wanted]
    if needed:
        step("0. Nạp PDF và chờ AI đọc (máy AI qua Ollama)")
        for key in needed:
            DOCS[key] = upload(as_(owners[key]), key)
        wait_read(list(DOCS.values()))
        for key, d in DOCS.items():
            print(f"  {key}: {d['job'].get('status')}")
    for name in wanted:
        try:
            {"main": lambda: scenario_main(DOCS), "return": scenario_return, "digitize": scenario_digitize, "council": scenario_council,
             "scan": scenario_scan, "delegation": scenario_delegation, "pages": scenario_pages}[name]()
        except Exception as error:     # một kịch bản hỏng không chặn các kịch bản sau
            check(False, f"kịch bản {name} dừng giữa chừng", f"{type(error).__name__}: {error}")
    for key, d in DOCS.items():
        if "aiType" in d:
            print(f"  AI gợi ý cho PDF {key}: {d['aiType']}, {d['aiFields']} trường có giá trị")
    print(f"\nTổng thời gian {time.monotonic() - started:.0f} giây · {len(failures)} kiểm tra hỏng")
    for message in failures:
        print(f"  ✗ {message}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
