"""Browser regression against an isolated local store and real cached OCR output.

Run with the SAM venv and PLAYWRIGHT_BROWSERS_PATH set to its installed browser.
No model inference is mocked: reuse an actual extraction as a cache fixture.
"""
import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BENCHMARK = ROOT / "data/sam3/runtime/extractions/57e223d70785467a948c8ff122d77298/result.json"
PDF = ROOT / "data/sam3/documents/badinh-001.pdf"


def main():
    assert BENCHMARK.is_file(), "Run the real badinh-001 extraction first."
    with tempfile.TemporaryDirectory(prefix="inbox-browser-", dir="/Volumes/quocDisk/AI/sam3/tmp") as temporary:
        runtime = Path(temporary)
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        url = f"http://127.0.0.1:{port}"
        env = {**os.environ, "SAM3_RUNTIME_DIR": str(runtime), "SAM3_PORT": str(port)}
        with (runtime / "server.log").open("w") as log:
            process = subprocess.Popen([str(ROOT / "scripts/sam3.sh"), "serve"], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                for _ in range(100):
                    try:
                        if httpx.get(url + "/api/inbox/documents").status_code == 200:
                            break
                    except httpx.ConnectError:
                        time.sleep(0.1)
                else:
                    raise AssertionError("Isolated server did not start")
                with sync_playwright() as p:
                    browser = p.chromium.launch()
                    page = browser.new_page(viewport={"width": 1440, "height": 1000})
                    errors = []
                    page.on("pageerror", lambda error: errors.append(str(error)))
                    page.goto(url)
                    page.wait_for_selector('[data-extract="badinh-001"]')

                    def upload_and_cache(name):
                        page.locator("#upload-pdf").set_input_files({"name": name, "mimeType": "application/pdf", "buffer": PDF.read_bytes()})
                        page.wait_for_function("name => document.querySelector('#pdf-list').textContent.includes(name)", arg=name)
                        docs = httpx.get(url + "/api/inbox/documents").json()["documents"]
                        doc = next(d for d in docs if d["title"] == name)
                        # Preserve the actual model output; only bind the identical uploaded PDF's identity.
                        job = uuid.uuid4().hex
                        dest = runtime / "extractions" / job
                        dest.mkdir()
                        result = json.loads(BENCHMARK.read_text())
                        result.update(document_id=doc["id"], source_sha256=doc["sha256"], job_id=job)
                        (dest / "result.json").write_text(json.dumps(result))
                        (dest / "status.json").write_text(json.dumps({"job_id": job, "document_id": doc["id"], "status": "completed"}))
                        (dest / "full-text.txt").write_text("\n".join(p["text"] for p in result["pages"]))
                        path = runtime / "inbox.json"
                        data = json.loads(path.read_text()) if path.exists() else {"documents": {}}
                        data["documents"][doc["id"]] = {"extraction_job_id": job}
                        path.write_text(json.dumps(data))
                        return doc

                    first = upload_and_cache("KIEM-THU-01.pdf")
                    page.locator(f'[data-extract="{first["id"]}"]').click()
                    page.wait_for_function("!document.querySelector('#file-pdf').disabled")
                    page.locator("#filing-department").select_option("vx")
                    page.locator("#filing-category").select_option("U21")
                    page.locator("#filing-type").select_option("U01-D06")
                    page.locator("[data-label]").first.fill("KIỂM THỬ SỬA DỮ LIỆU")
                    page.locator("#filing-type").select_option("U01-D01")
                    page.locator("#filing-type").select_option("U01-D06")
                    assert page.locator("[data-label]").first.input_value() == "KIỂM THỬ SỬA DỮ LIỆU"
                    page.locator("#new-case-title").fill("Hồ sơ giáo dục · kiểm thử")
                    page.screenshot(path=str(ROOT / "artifacts/pdf-filing-tested.png"))
                    page.locator("#file-pdf").click()
                    page.wait_for_function("!document.querySelector('#extract-dialog').open")
                    receipts = httpx.get(url + "/api/inbox/placements").json()["placements"]
                    assert len(receipts) == 1
                    receipt = receipts[0]
                    case_id = receipt["case"]["id"]
                    assert receipt["document"]["fields"][0]["value"] == "KIỂM THỬ SỬA DỮ LIỆU"
                    assert receipt["case"]["categoryCode"] == "U21"
                    assert not receipt["document"]["reviewed"]
                    page.goto(url + "/quan-ly-ho-so.html?case=" + case_id)
                    page.wait_for_selector("#case-dialog[open]")
                    assert page.locator("#document-preview iframe").count() == 1
                    assert page.locator("[data-field]").first.input_value() == "KIỂM THỬ SỬA DỮ LIỆU"
                    page.locator("[data-field]").first.fill("SỬA LẠI TRONG HỒ SƠ")
                    page.locator("#save-draft").click()
                    page.reload()
                    page.wait_for_selector("#case-dialog[open]")
                    assert page.locator("[data-field]").first.input_value() == "SỬA LẠI TRONG HỒ SƠ"

                    page.goto(url + "/scan-inbox.html")
                    second = upload_and_cache("KIEM-THU-02.pdf")
                    page.locator(f'[data-extract="{second["id"]}"]').click()
                    page.wait_for_function("!document.querySelector('#file-pdf').disabled")
                    page.locator("#filing-department").select_option("vx")
                    page.locator("#filing-category").select_option("U21")
                    page.locator("#filing-type").select_option("U01-D06")
                    page.locator("#target-case").select_option(case_id)
                    assert page.locator("#new-case-label").is_hidden()
                    page.locator("#file-pdf").click()
                    page.wait_for_function("!document.querySelector('#extract-dialog').open")
                    data = page.evaluate("JSON.parse(localStorage.getItem('ubnd-hdnd-pilot-v1'))")
                    case = next(r for r in data["records"] if r["id"] == case_id)
                    assert len(case["documents"]) == 2
                    assert case["documents"][0]["fields"][0]["value"] == "SỬA LẠI TRONG HỒ SƠ"
                    page.goto(url + "/scan-inbox.html")
                    page.wait_for_selector('[data-delete="badinh-001"]')
                    page.once("dialog", lambda dialog: dialog.accept())
                    page.locator('[data-delete="badinh-001"]').click()
                    page.wait_for_selector("#undo-delete:not([hidden])")
                    page.wait_for_function("!document.querySelector('[data-delete=\"badinh-001\"]')")
                    page.locator("#undo-delete").click()
                    page.wait_for_selector('[data-delete="badinh-001"]')
                    page.set_viewport_size({"width": 390, "height": 844})
                    assert page.evaluate("document.documentElement.scrollWidth") == 390
                    page.screenshot(path=str(ROOT / "artifacts/pdf-inbox-mobile-tested.png"), full_page=True)
                    assert not errors, errors
                    browser.close()
                    print("PASS: PDF upload, editable extraction, independent type/topic, new/existing case filing, durable original, reload preserving edits, delete/undo, mobile width.")
            finally:
                process.terminate()
                process.wait(timeout=15)


if __name__ == "__main__":
    main()
