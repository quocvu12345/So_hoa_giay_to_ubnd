(() => {
  'use strict';
  const $ = id => document.getElementById(id), catalog = window.HOSO_CATALOG;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let profile;
  try { profile = JSON.parse(sessionStorage.getItem('hoso-pilot-role')); } catch { /* Choose the visible prototype default below. */ }
  profile ||= { kind: 'clerk', department: '', user: 'cv-01' };
  const editable = ['clerk', 'employee'].includes(profile.kind);
  const sampleLabels = { synthetic_blank_control: 'Mẫu trống đối chứng · giữ nguyên bố cục', public_blank_form: 'Mẫu trống công khai', public_anonymized_example: 'Mẫu điền sẵn · nguồn đã thay thông tin', synthetic_handwriting_font: 'Giả lập chữ viết tay bằng font', synthetic_filled_handwriting: 'Đã điền giả lập · chữ mô phỏng', synthetic_handwriting_image: 'Đã điền giả lập · nét bút tay AI', synthetic_mixed_packet: 'Giả lập · nhiều loại giấy tờ', synthetic_complete_packet: 'Bộ dữ liệu giả đầy đủ giấy tờ · cùng thông tin người khai' };
  const available = catalog.filter(c => profile.kind !== 'employee' || c.owner === profile.department);
  let rows = [], records = [], filter = 'pending', selected = null, page = 1, result = null, activeJob = null, generation = 0, draft = new Map(), deletedId = null;
  const selectOptions = (id, options, selectedValue) => {
    $(id).replaceChildren(...options.map(([value, label]) => new Option(label, value)));
    if (options.some(([v]) => v === selectedValue)) $(id).value = selectedValue;
  };
  async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Dữ liệu gửi chưa hợp lệ. Kiểm tra lại các trường.');
    return data;
  }
  function toast(message, undo = false) {
    // Dialog content is in the top layer; keep errors visible there as well.
    if ($('extract-dialog').open) $('save-message').textContent = message;
    $('toast-text').textContent = message; $('undo-delete').hidden = !undo; $('toast').hidden = false;
  }
  function render() {
    const pending = rows.filter(r => !r.filed_case_id);
    $('pending-count').textContent = pending.length; $('filed-count').textContent = rows.length - pending.length;
    const query = $('search').value.toLocaleLowerCase('vi');
    const sample = $('sample-filter').value;
    const sampleGroup = $('sample-category').value;
    const shown = rows.filter(r => (filter === 'filed' ? !!r.filed_case_id : !r.filed_case_id) && r.title.toLocaleLowerCase('vi').includes(query)
      && (!sample || (sample === 'dossiers' ? ['tuliem-dossiers-v1', 'tuliem-dossiers-full-v2'].includes(r.dataset) : sample === 'bulk441' ? r.dataset === 'official-input-tests-441-v1' : sample === 'official-inputs' ? r.dataset === 'official-input-tests-v1' : sample === 'citizen' ? r.dataset === 'citizen-forms-v1' : sample === 'filled' ? r.dataset === 'filled-catalog-v1' : r.sample_kind === sample))
      && (!sampleGroup || r.suggested_work_group === sampleGroup));
    $('sample-catalog-note').hidden = !['filled', 'synthetic_handwriting_image'].includes(sample);
    $('pdf-list').innerHTML = shown.map(r => `<tr><td><div class="pdf-name"><span class="paper-icon">PDF</span><div><a href="/api/sam3/documents/${encodeURIComponent(r.id)}/file" target="_blank" rel="noopener"><strong>${escape(r.title)}</strong></a><small>${(r.byte_size / 1048576).toFixed(1)} MB · ${escape(r.publisher || 'Bản scan của bạn')}</small></div></div></td><td>${r.page_count}</td><td><span class="status ${r.filed_case_id ? 'filed' : ''}">${r.filed_case_id ? 'Đã xếp hồ sơ' : 'Chờ xử lý'}</span></td><td><div class="row-actions">${r.filed_case_id ? `<a href="quan-ly-ho-so.html?case=${encodeURIComponent(r.filed_case_id)}">Xem hồ sơ ↗</a>` : `<button data-extract="${escape(r.id)}" ${editable ? '' : 'disabled'}>Lấy dữ liệu</button><button class="delete" data-delete="${escape(r.id)}" ${editable ? '' : 'disabled'}>Xóa</button>`}</div></td></tr>`).join('');
    $('empty').hidden = shown.length > 0; $('list-count').textContent = `${shown.length} tài liệu PDF`;
    shown.forEach((r, index) => {
      if (!r.sample_kind) return;
      const cell = $('pdf-list').children[index].querySelector('.pdf-name > div');
      const note = document.createElement('small'); note.className = 'sample-kind'; note.textContent = sampleLabels[r.sample_kind] || 'Mẫu kiểm thử'; cell.append(note);
      if (r.source_url?.startsWith('https://')) {
        const source = document.createElement('a'); source.href = r.source_url; source.target = '_blank'; source.rel = 'noopener'; source.className = 'sample-source'; source.textContent = 'Nguồn biểu mẫu ↗'; cell.append(source);
      }
    });
  }
  async function refresh() {
    try {
      const data = await api('/api/inbox/documents'); rows = data.documents; render();
      $('connection-error').hidden = true;
    } catch (error) {
      $('connection-error').textContent = `${error.message} Mở trang tại http://127.0.0.1:8765 và chạy ./scripts/document-ai.sh serve nếu dịch vụ chưa bật.`;
      $('connection-error').hidden = false;
    }
  }
  async function upload(files) {
    if (!editable) return;
    $('upload-pdf').disabled = true;
    let added = 0;
    try {
      for (const file of files) {
        if (!/\.pdf$/i.test(file.name) || file.size > 40 * 1048576) throw new Error(`${file.name}: chỉ nhận PDF tối đa 40 MB.`);
        $('upload-state').textContent = `Đang nạp ${file.name}…`;
        await api('/api/inbox/documents', { method: 'POST', headers: { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(file.name) }, body: file });
        added++;
      }
      toast(`Đã thêm ${added} PDF. Chọn “Lấy dữ liệu” để bắt đầu.`);
    } catch (error) { toast(`${added ? `Đã thêm ${added} PDF. ` : ''}${error.message}`); }
    finally { $('upload-state').textContent = ''; $('upload-pdf').disabled = false; $('upload-pdf').value = ''; await refresh(); }
  }
  function stash() {
    document.querySelectorAll('[data-label]').forEach(input => draft.set(input.dataset.label, { ...draft.get(input.dataset.label), value: input.value }));
  }
  function fieldSummary() {
    const inputs = [...$('metadata-fields').querySelectorAll('[data-label]')];
    const filled = inputs.filter(input => input.value.trim()).length;
    $('field-summary').textContent = inputs.length ? `${filled}/${inputs.length} trường có dữ liệu · ${inputs.length - filled} trường còn trống` : 'Chọn loại giấy tờ để hiển thị các trường.';
    $('export-fields').disabled = !inputs.length;
  }
  function fields() {
    const type = catalog.flatMap(c => c.documentTypes).find(t => t.id === $('filing-type').value);
    const groups = type?.fieldGroups || (type ? [{ title: 'Thông tin giấy tờ', fields: type.fields }] : []);
    $('metadata-fields').innerHTML = groups.map(group => `<fieldset class="extraction-group"><legend>${escape(group.title)}</legend><div class="input-grid">${group.fields.map(label => {
      const field = draft.get(label) || { value: '', quote: '' };
      const long = /trích yếu|nội dung|mô tả|kèm theo|tài liệu|thành phần|các con|cha mẹ|các bên|giá trị từng/i.test(label);
      const pages = (field.source_pages || []).filter(p => Number.isInteger(p) && p > 0 && p <= selected?.page_count);
      const input = long ? `<textarea data-label="${escape(label)}" rows="3" maxlength="2000">${escape(field.value)}</textarea>` : `<input type="text" data-label="${escape(label)}" value="${escape(field.value)}" maxlength="2000"${/^Ngày/.test(label) ? ' placeholder="Ngày/tháng/năm theo bản gốc"' : ''}>`;
      return `<div class="extraction-field${long ? ' wide' : ''}${field.value ? '' : ' missing'}"><label><span>${escape(label)} <small class="value-state">${field.value ? 'Cần đối chiếu' : 'Chưa có dữ liệu'}</small></span>${input}</label><div class="field-evidence">${field.quote ? `<details><summary>Xem đoạn nguồn</summary><p>“${escape(field.quote)}”</p></details>` : 'Nhập sau khi đối chiếu bản gốc.'}${pages.map(p => `<button type="button" class="source-page" data-source-page="${p}">Trang ${p} ↗</button>`).join('')}</div></div>`;
    }).join('')}</div></fieldset>`).join('');
    fieldSummary();
  }
  function targets() {
    const category = $('filing-category').value;
    const eligible = records.filter(r => r.categoryCode === category && ['draft', 'returned'].includes(r.workflow || 'draft') && (profile.kind !== 'employee' || (r.assignee || 'cv-01') === profile.user));
    selectOptions('target-case', [['new', '＋ Tạo hồ sơ mới'], ...eligible.map(r => [r.id, `${r.code} · ${r.title}`])], $('target-case').value);
    updateTarget();
  }
  function types(preferred) {
    preferred ||= $('filing-type').value;
    const category = catalog.find(c => c.code === $('filing-category').value);
    const ordered = [...catalog].sort((a, b) => (b === category ? 1 : 0) - (a === category ? 1 : 0));
    $('filing-type').replaceChildren(new Option('Chọn loại giấy tờ', ''));
    for (const c of ordered) {
      const group = document.createElement('optgroup'); group.label = `${c.code} · ${c.title}`;
      group.append(...c.documentTypes.map(t => new Option(t.name, t.id))); $('filing-type').append(group);
    }
    if (catalog.some(c => c.documentTypes.some(t => t.id === preferred))) $('filing-type').value = preferred;
    fields(); targets();
  }
  function categories(preferred, type) {
    selectOptions('filing-category', [['', 'Chọn nhóm hồ sơ'], ...available.filter(c => c.owner === $('filing-department').value).map(c => [c.code, `${c.group} · ${c.title}`])], preferred);
    types(type);
  }
  function updateTarget() {
    const isNew = $('target-case').value === 'new';
    $('new-case-label').hidden = !isNew; $('new-case-title').required = isNew;
  }
  function preview() {
    $('page-preview').src = `/api/sam3/documents/${encodeURIComponent(selected.id)}/preview?page=${page}`;
    $('page-label').textContent = `Trang ${page} / ${selected.page_count}`;
    $('previous-page').disabled = page <= 1; $('next-page').disabled = page >= selected.page_count;
    $('page-text').textContent = result?.pages.find(p => p.page === page)?.text || 'Chưa có nội dung đọc được trên trang này.';
  }
  function populate(data) {
    result = data; const suggestion = data.suggestion;
    draft = new Map((suggestion?.fields || []).map(f => [f.label, f]));
    $('document-title').value = suggestion?.title || selected.title;
    $('new-case-title').value = suggestion?.title || selected.title;
    const category = available.find(c => c.code === suggestion?.category_code);
    if (category) $('filing-department').value = category.owner;
    categories(category?.code, suggestion?.type_id);
    $('suggestion-note').textContent = suggestion ? `${suggestion.document_form} · ${suggestion.reason}${!category && suggestion.category_code ? ' Gợi ý nằm ngoài phạm vi vai trò hiện tại; hãy chọn lại nơi lưu hoặc đổi vai trò tại kho hồ sơ.' : ''}` : 'Chưa có gợi ý phân loại. Chọn nhóm, loại và điền dữ liệu theo PDF.';
    const warnings = [...data.warnings, ...(suggestion?.field_extraction_warnings || [])];
    if (!data.all_pages_read) warnings.unshift('Có trang chưa đọc đủ dữ liệu. Đối chiếu PDF gốc trước khi lưu.');
    if (suggestion?.mixed_documents) warnings.push('Có thể có nhiều văn bản độc lập trong PDF. Tách hoặc kiểm tra lại trước khi chọn một loại giấy tờ.');
    if (suggestion?.classification_uses_excerpts) warnings.push('PDF dài: AI phân loại dựa trên trích đoạn từ các trang. Toàn bộ nội dung đọc được vẫn có trong tệp tải xuống.');
    $('extraction-warning').textContent = warnings.join('\n'); $('extraction-warning').hidden = !warnings.length;
    $('download-text').href = `/api/inbox/jobs/${activeJob}/text`; $('download-text').hidden = false;
    $('file-pdf').disabled = false; $('job-progress').hidden = true;
    $('save-message').textContent = `Đã xử lý ${data.processed_pages}/${data.page_count} trang · ${Math.round(data.elapsed_seconds)} giây. Kiểm tra dữ liệu trước khi lưu.`;
    preview();
  }
  async function extract(id, retry = false) {
    if (!editable) return;
    const ticket = ++generation;
    selected = rows.find(r => r.id === id); result = null; page = 1; draft = new Map(); activeJob = null;
    $('filing-form').reset(); $('file-pdf').disabled = true; $('download-text').hidden = true; $('extraction-warning').hidden = true; $('retry-extraction').hidden = true;
    $('job-progress').hidden = false; $('progress-text').textContent = 'Đang chuẩn bị đọc PDF…';
    $('source-name').textContent = selected.title; $('open-original').href = `/api/sam3/documents/${encodeURIComponent(id)}/file`;
    $('document-title').value = selected.title; $('new-case-title').value = selected.title;
    const owners = [...new Set(available.map(c => c.owner))];
    selectOptions('filing-department', owners.map(owner => [owner, window.HOSO_DEPARTMENTS.find(d => d.id === owner).name]), profile.department);
    categories(); preview(); $('extract-dialog').showModal();
    try {
      const synced = await window.ScanBridge.sync();
      if (ticket !== generation) return;
      records = synced;
      let job = await api(`/api/inbox/documents/${encodeURIComponent(id)}/extract${retry ? '?retry=true' : ''}`, { method: 'POST' });
      if (ticket !== generation) return;
      activeJob = job.job_id;
      while (ticket === generation) {
        job = await api(`/api/inbox/jobs/${job.job_id}`);
        if (ticket !== generation) return;
        if (job.status === 'failed') throw new Error(job.error);
        if (job.status === 'completed') { populate(job.result); $('retry-extraction').hidden = false; await refresh(); return; }
        $('progress-text').textContent = job.progress?.message || 'Đang chờ AI local xử lý…';
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    } catch (error) {
      if (ticket !== generation) return;
      $('job-progress').hidden = true; $('extraction-warning').textContent = error.message + ' Bạn có thể đóng và lấy dữ liệu lại, hoặc nhập theo bản gốc.'; $('extraction-warning').hidden = false;
      $('file-pdf').disabled = false;
      $('retry-extraction').hidden = false;
    }
  }
  $('filing-form').addEventListener('submit', async event => {
    event.preventDefault(); if (!editable) return;
    stash(); $('file-pdf').disabled = true;
    try {
      const target = records.find(r => r.id === $('target-case').value);
      const type = catalog.flatMap(c => c.documentTypes).find(t => t.id === $('filing-type').value);
      if (!type) throw new Error('Chọn nhóm hồ sơ và loại giấy tờ.');
      const payload = { category_code: $('filing-category').value, type_id: type.id, title: $('document-title').value.trim(),
        fields: type.fields.map(label => ({ label, value: draft.get(label)?.value || '' })), direction: $('direction').value,
        target_case: target ? { ...target, workflow: target.workflow || 'draft', assignee: target.assignee || 'cv-01' } : null,
        new_case_title: $('new-case-title').value.trim(), reviewed: $('reviewed').checked,
        role: profile.kind, department: profile.department || '', assignee: profile.user };
      const receipt = await api(`/api/inbox/documents/${encodeURIComponent(selected.id)}/file`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      records = await window.ScanBridge.sync();
      try { sessionStorage.setItem('hoso-pilot-role', JSON.stringify(profile)); } catch { /* Durable receipt is already saved locally. */ }
      $('extract-dialog').close(); generation++; filter = 'filed';
      document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b.dataset.filter === filter));
      toast(`Đã đưa PDF vào “${receipt.case.title}”.`); await refresh();
    } catch (error) { toast(error.message); }
    finally { $('file-pdf').disabled = false; }
  });
  $('pdf-list').addEventListener('click', async event => {
    const extractButton = event.target.closest('[data-extract]');
    if (extractButton) { extract(extractButton.dataset.extract); return; }
    const button = event.target.closest('[data-delete]');
    if (!button || !editable) return;
    const row = rows.find(r => r.id === button.dataset.delete);
    if (!confirm(`Xóa “${row.title}” khỏi danh sách chờ? Có thể hoàn tác ngay sau khi xóa.`)) return;
    try { await api(`/api/inbox/documents/${encodeURIComponent(row.id)}`, { method: 'DELETE' }); deletedId = row.id; toast('Đã xóa PDF khỏi danh sách chờ.', true); await refresh(); } catch (error) { toast(error.message); }
  });
  $('undo-delete').addEventListener('click', async () => {
    if (!deletedId) return;
    try { await api(`/api/inbox/documents/${encodeURIComponent(deletedId)}/restore`, { method: 'POST' }); deletedId = null; toast('Đã khôi phục PDF.'); await refresh(); } catch (error) { toast(error.message); }
  });
  ['close-dialog', 'cancel-dialog'].forEach(id => $(id).addEventListener('click', () => $('extract-dialog').close()));
  $('extract-dialog').addEventListener('close', () => { generation++; });
  $('filing-department').addEventListener('change', () => { stash(); categories(); });
  $('filing-category').addEventListener('change', () => { stash(); types(); });
  $('filing-type').addEventListener('change', () => { stash(); fields(); });
  $('metadata-fields').addEventListener('input', event => {
    if (!event.target.matches('[data-label]')) return;
    const wrapper = event.target.closest('.extraction-field');
    wrapper.classList.toggle('missing', !event.target.value.trim());
    wrapper.querySelector('.value-state').textContent = event.target.value.trim() ? 'Đã chỉnh sửa' : 'Chưa có dữ liệu';
    fieldSummary();
  });
  $('metadata-fields').addEventListener('click', event => {
    const button = event.target.closest('[data-source-page]');
    if (!button) return;
    page = Number(button.dataset.sourcePage); preview();
    $('page-preview').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('export-fields').addEventListener('click', () => {
    stash();
    const type = catalog.flatMap(c => c.documentTypes).find(t => t.id === $('filing-type').value);
    if (!type) return;
    const data = { document_id: selected.id, source_sha256: selected.sha256, type_id: type.id,
      reviewed: $('reviewed').checked, fields: type.fields.map(label => ({ ...draft.get(label), label, value: draft.get(label)?.value || '' })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `${selected.id}-fields.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('filing-form').addEventListener('input', event => { if (event.target.id !== 'reviewed') $('reviewed').checked = false; });
  $('target-case').addEventListener('change', updateTarget);
  $('retry-extraction').addEventListener('click', () => extract(selected.id, true));
  $('previous-page').addEventListener('click', () => { page--; preview(); }); $('next-page').addEventListener('click', () => { page++; preview(); });
  $('search').addEventListener('input', render);
  const params = new URLSearchParams(location.search);
  const sampleSelection = params.get('samples');
  if ([...$('sample-filter').options].some(o => o.value === sampleSelection)) $('sample-filter').value = sampleSelection;
  selectOptions('sample-category', [['', 'Tất cả nhóm giấy tờ'], ...catalog.map(c => [c.code, `${c.code} · ${c.title}`])], params.get('category'));
  $('sample-filter').addEventListener('change', render);
  $('sample-category').addEventListener('change', render);
  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('selected', b === button)); render(); }));
  $('upload-pdf').disabled = !editable;
  $('upload-pdf').addEventListener('change', event => upload([...event.target.files]));
  ['dragenter', 'dragover'].forEach(name => $('dropzone').addEventListener(name, event => { event.preventDefault(); $('dropzone').classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(name => $('dropzone').addEventListener(name, event => { event.preventDefault(); $('dropzone').classList.remove('dragging'); }));
  $('dropzone').addEventListener('drop', event => upload([...event.dataTransfer.files]));
  $('role-note').innerHTML = `${profile.kind === 'clerk' ? 'Văn thư / lưu trữ' : profile.kind === 'employee' ? 'Chuyên viên · ' + escape(window.HOSO_DEPARTMENTS.find(d => d.id === profile.department)?.name || '') : 'Chế độ xem'} · Vai trò thí điểm. <a href="quan-ly-ho-so.html">Đổi vai trò tại kho hồ sơ ↗</a>`;
  api('/api/inbox/status').then(status => { $('ai-state').textContent = status.ready ? '● AI local sẵn sàng' : '● Chưa đủ mô hình'; $('ai-state').classList.toggle('offline', !status.ready); }).catch(() => { $('ai-state').textContent = '● Chưa kết nối local'; $('ai-state').classList.add('offline'); });
  refresh().then(() => { const id = params.get('document'); if (id && rows.some(r => r.id === id)) extract(id); });
})();
