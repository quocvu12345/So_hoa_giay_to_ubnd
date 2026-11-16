"use strict";
(() => {
  const $ = id => document.getElementById(id);
  let documents = [], selected = null, page = 1, checkpoint = false, busy = false;
  function error(message = "") { $("error").textContent = message; $("error").hidden = !message; }
  async function api(path, options = {}) {
    const response = await fetch(path, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Yêu cầu thất bại (${response.status}).`);
    return data;
  }
  function updateButtons() {
    $("run").disabled = !selected || !checkpoint || busy;
    $("prev-page").disabled = !selected || page <= 1 || busy;
    $("next-page").disabled = !selected || page >= selected.page_count || busy;
    $("page").disabled = busy || !selected;
    $("upload").disabled = busy;
    $("prompt").disabled = busy;
    $("threshold").disabled = busy;
    document.querySelectorAll("[data-prompt]").forEach(button => button.disabled = busy);
  }
  async function refreshStatus() {
    try {
      const status = await api("/api/sam3/status");
      checkpoint = status.checkpoint_present;
      $("model-status").textContent = status.model_loaded ? "Model đã nạp" : checkpoint ? "Đã có trọng số" : "Chờ tải trọng số";
      $("model-device").textContent = `SAM 3 · ${status.device.toUpperCase()} · Transformers ${status.versions.transformers}`;
      const notice = $("setup-notice");
      notice.hidden = checkpoint;
      notice.replaceChildren();
      if (!checkpoint) {
        notice.append("Môi trường local đã sẵn sàng. Bạn có thể xem giấy tờ và nạp tệp ngay. Để nhận diện, xin quyền tại ");
        const link = document.createElement("a"); link.href = "https://huggingface.co/facebook/sam3"; link.target = "_blank"; link.rel = "noopener"; link.textContent = "facebook/sam3"; notice.append(link);
        notice.append(". Sau khi được duyệt, chạy trong Terminal: ");
        for (const command of ["./scripts/sam3.sh login", "./scripts/sam3.sh download"]) {
          const code = document.createElement("code"); code.textContent = command; notice.append(code, " ");
        }
      }
      if (status.active_job_id && !busy) {
        busy = true; renderList(); updateButtons();
        await followJob(status.active_job_id);
      }
      updateButtons();
    } catch (e) {
      checkpoint = false; updateButtons();
      $("model-status").textContent = "Chưa kết nối dịch vụ";
      error("Mở Terminal tại dự án, chạy ./scripts/sam3.sh serve rồi truy cập http://127.0.0.1:8765. " + e.message);
    }
  }
  function renderList() {
    const query = $("search").value.trim().toLocaleLowerCase("vi");
    const list = $("document-list"); list.replaceChildren();
    const matches = documents.filter(d => `${d.title} ${d.document_form} ${d.publisher}`.toLocaleLowerCase("vi").includes(query));
    $("sample-count").textContent = `${matches.length} / ${documents.length}`;
    matches.forEach(doc => {
      const button = document.createElement("button"); button.className = "document-item"; button.type = "button"; button.disabled = busy;
      button.setAttribute("aria-current", String(doc.id === selected?.id));
      const kind = document.createElement("span"); kind.className = "doc-kind"; kind.textContent = `${doc.document_form} · ${doc.page_count} trang`;
      const title = document.createElement("strong"); title.textContent = doc.title;
      const source = document.createElement("small"); source.textContent = doc.publisher;
      button.append(kind, title, source); button.addEventListener("click", () => select(doc)); list.append(button);
    });
    if (!matches.length) { const p = document.createElement("p"); p.textContent = "Không có tài liệu phù hợp."; list.append(p); }
  }
  function clearResult() {
    $("overlay").hidden = true; $("overlay").removeAttribute("src");
    $("result-empty").hidden = false; $("json-link").hidden = true;
    $("result-summary").hidden = true; $("region-list").replaceChildren();
    $("job-status").hidden = true;
  }
  function select(doc) {
    if (busy) return;
    selected = doc; page = 1;
    $("document-title").textContent = doc.title;
    $("document-type").textContent = `${doc.document_form.toLocaleUpperCase("vi")} · NHÃN TỪ NGUỒN`;
    $("document-source").textContent = `${doc.publisher} · ${(doc.byte_size / 1048576).toFixed(1)} MB`;
    $("source-link").hidden = !doc.source_url;
    if (doc.source_url) $("source-link").href = doc.source_url;
    $("original-link").hidden = false; $("original-link").href = `/api/sam3/documents/${doc.id}/file`;
    $("page").max = doc.page_count;
    renderList(); showPage();
  }
  function showPage() {
    if (!selected) return;
    clearResult(); error();
    $("page").value = page; $("page-total").textContent = `/ ${selected.page_count}`;
    const image = $("preview"); image.hidden = true;
    $("preview-empty").hidden = false; $("preview-empty").textContent = "Đang mở trang…";
    image.onload = () => { image.hidden = false; $("preview-empty").hidden = true; $("page-size").textContent = `${image.naturalWidth} × ${image.naturalHeight} px`; };
    image.onerror = () => { $("preview-empty").textContent = "Không mở được trang. Kiểm tra tệp hoặc dịch vụ local."; };
    image.src = `/api/sam3/documents/${selected.id}/preview?page=${page}`;
    updateButtons();
  }
  function showResult(result) {
    $("prompt").value = result.prompt;
    $("threshold").value = result.threshold;
    $("threshold-value").value = Number(result.threshold).toFixed(2);
    $("overlay").src = result.overlay_url; $("overlay").hidden = false; $("result-empty").hidden = true;
    $("json-link").href = `/api/sam3/jobs/${result.job_id}/artifacts/result.json`; $("json-link").hidden = false;
    $("result-summary").hidden = false;
    $("result-summary").textContent = `${result.detected_count} vùng khớp “${result.prompt}” · ${result.elapsed_seconds} giây · ${result.device.toUpperCase()}` + (result.detected_count > result.exported_count ? ` · Xuất ${result.exported_count} vùng có điểm cao nhất` : "");
    $("region-list").replaceChildren();
    result.regions.forEach(region => {
      const link = document.createElement("a"); link.href = region.mask_url; link.target = "_blank"; link.rel = "noopener";
      link.textContent = `Vùng ${region.index} · điểm ${region.score.toFixed(3)} · mask ↗`; $("region-list").append(link);
    });
  }
  async function followJob(jobId) {
    const started = Date.now();
    $("job-status").hidden = false;
    try {
      while (true) {
        const job = await api(`/api/sam3/jobs/${jobId}`);
        if (job.status === "failed") throw new Error(job.error || "Nhận diện thất bại.");
        if (job.status === "completed") {
          // When resuming after a reload, select the actual input before displaying its result.
          if (selected?.id !== job.document_id || page !== job.page) {
            const doc = documents.find(d => d.id === job.document_id);
            if (doc) { busy = false; select(doc); page = job.page; showPage(); busy = true; }
            else throw new Error("Lần chạy đã hoàn tất cho tệp nạp ở phiên trước. Mở JSON qua API để xem kết quả.");
          }
          showResult(job.result); $("job-status").hidden = true; break;
        }
        $("job-status").textContent = `Đang ${job.status === "queued" ? "chờ xử lý" : "nạp model / nhận diện"}… ${Math.floor((Date.now() - started) / 1000)} giây. Lần đầu cần thêm thời gian nạp trọng số.`;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (e) { error(e.message); $("job-status").hidden = true; }
    finally { busy = false; renderList(); updateButtons(); }
  }
  $("segment-form").addEventListener("submit", async event => {
    event.preventDefault(); if (!selected || busy || !checkpoint) return;
    error(); clearResult(); busy = true; updateButtons(); renderList();
    try {
      const job = await api("/api/sam3/jobs", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({document_id:selected.id, page, prompt:$("prompt").value.trim(), threshold:Number($("threshold").value)})});
      await followJob(job.job_id);
    } catch (e) { error(e.message); busy = false; updateButtons(); renderList(); }
  });
  $("upload").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 40 * 1048576) { error("Tệp tối đa 40 MB."); event.target.value = ""; return; }
    error(); busy = true; updateButtons(); renderList();
    try {
      const doc = await api("/api/sam3/documents", {method:"POST", headers:{"Content-Type":"application/octet-stream", "X-Filename":encodeURIComponent(file.name)}, body:file});
      documents.unshift(doc); busy = false; select(doc);
    } catch (e) { error(e.message); }
    finally { busy = false; updateButtons(); renderList(); event.target.value = ""; }
  });
  $("search").addEventListener("input", renderList);
  $("prev-page").addEventListener("click", () => { if (page > 1 && !busy) { page--; showPage(); } });
  $("next-page").addEventListener("click", () => { if (selected && page < selected.page_count && !busy) { page++; showPage(); } });
  $("page").addEventListener("change", () => { if (selected && !busy) { page = Math.min(selected.page_count, Math.max(1, Math.floor(Number($("page").value) || 1))); showPage(); } });
  $("threshold").addEventListener("input", () => $("threshold-value").value = Number($("threshold").value).toFixed(2));
  document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => { $("prompt").value = button.dataset.prompt; }));
  $("refresh-status").addEventListener("click", refreshStatus);
  async function start() {
    try { documents = (await api("/api/sam3/documents")).documents; renderList(); if (documents.length) select(documents.find(d => d.id === "public-002") || documents[0]); }
    catch (e) { error(e.message); }
    await refreshStatus();
  }
  start();
  setInterval(() => { if (!busy) refreshStatus(); }, 15000);
})();
