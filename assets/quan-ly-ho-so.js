(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const catalog = window.HOSO_CATALOG;
  const departments = window.HOSO_DEPARTMENTS;
  const categoryByCode = new Map(catalog.map((item) => [item.code, item]));
  const documentTypeById = new Map(catalog.flatMap((category) => category.documentTypes.map((type) => [type.id, { ...type, categoryCode: category.code }])));
  const departmentById = new Map(departments.map((item) => [item.id, item]));
  const storageKey = 'ubnd-hdnd-pilot-v1';
  const statusNames = { received: 'Mới tiếp nhận', review: 'Chờ kiểm tra', archived: 'Đã lưu trữ' };
  const flowNames = { draft: 'Đang chuẩn bị', returned: 'Yêu cầu bổ sung', department_review: 'Chờ trưởng phòng / Ban', leadership_review: 'Chờ lãnh đạo cho ý kiến', ready_archive: 'Chờ tiếp nhận nộp lưu', archived: 'Đã lưu trữ' };
  const roleNames = { employee: 'Chuyên viên', clerk: 'Văn thư / lưu trữ', manager: 'Trưởng phòng / Trưởng Ban', chair: 'Chủ tịch UBND', council: 'Chủ tịch / Thường trực HĐND' };
  const professionalDepartments = ['vp', 'nv', 'kt', 'ht', 'vx'];
  const managerDepartments = [...professionalDepartments, 'bkt', 'bvx', 'mc', 'qp'];
  const employeeDepartments = [...managerDepartments, 'tt', 'db'];
  let profile = { kind: 'employee', department: 'ht', user: 'cv-01' }, roleChosen = false, activeView = 'all', topicFilter = '', classificationDirty = false;
  try {
    const savedRole = JSON.parse(sessionStorage.getItem('hoso-pilot-role') || 'null');
    if (savedRole && Object.hasOwn(roleNames, savedRole.kind) && ['cv-01', 'cv-02'].includes(savedRole.user) && (!['employee', 'manager'].includes(savedRole.kind) || (savedRole.kind === 'manager' ? managerDepartments : employeeDepartments).includes(savedRole.department))) { profile = savedRole; roleChosen = true; }
  } catch { /* A blocked session store does not prevent choosing a demo role. */ }
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const icon = (name) => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
  const badge = (status) => `<span class="status ${status}">${statusNames[status]}</span>`;
  const date = (value, time = false) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }).format(new Date(value));
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionFiles = new Map();
  let activeId = null, activeDocId = null, pageNumber = 1, sortDescending = true, toastTimer, reviewDirty = false;
  const pageSize = 8;
  let storageWorks = true;

  function workflow(record) { return record.workflow || (record.status === 'archived' ? 'archived' : 'draft'); }
  function inScope(record) {
    const category = categoryByCode.get(record.categoryCode);
    if (profile.kind === 'employee') return category.owner === profile.department && (record.assignee || 'cv-01') === profile.user;
    if (profile.kind === 'manager') return category.owner === profile.department;
    if (profile.kind === 'chair') return category.group === 'UBND';
    if (profile.kind === 'council') return category.group === 'HĐND';
    return profile.kind === 'clerk';
  }
  function canEdit(record) { return inScope(record) && ['employee', 'clerk'].includes(profile.kind) && ['draft', 'returned'].includes(workflow(record)); }
  function allVerified(record) { return record.documents.length > 0 && record.documents.every((doc) => doc.reviewed); }
  function canManage(record) { return inScope(record) && profile.kind === 'manager' && workflow(record) === 'department_review'; }
  function canDecide(record) { return inScope(record) && ['chair', 'council'].includes(profile.kind) && workflow(record) === 'leadership_review'; }
  function canAssign(record) { return inScope(record) && profile.kind === 'manager' && ['draft', 'returned', 'department_review'].includes(workflow(record)); }
  function canArchive(record) { return profile.kind === 'clerk' && workflow(record) === 'ready_archive' && allVerified(record); }
  function canCreate() { return ['employee', 'clerk'].includes(profile.kind); }
  function needsAction(record) {
    if (!inScope(record)) return false;
    if (profile.kind === 'employee') return ['draft', 'returned'].includes(workflow(record));
    if (profile.kind === 'clerk') return workflow(record) === 'ready_archive';
    return canManage(record) || canDecide(record);
  }
  function scopedRecords() { return records.filter(inScope); }
  function flowBadge(record) { const step = workflow(record); return `<span class="flow-badge flow-${step}">${flowNames[step]}</span>`; }
  function deadlineLabel(record) {
    if (!record.dueDate) return 'Chưa đặt hạn nội bộ';
    return `Hạn nội bộ: ${date(`${record.dueDate}T12:00:00+07:00`)}`;
  }
  function actorLabel() { return `${roleNames[profile.kind]}${profile.department ? ` · ${departmentById.get(profile.department)?.name || ''}` : ''}${profile.kind === 'employee' ? ` · ${profile.user}` : ''}`; }
  function availableCategories() { return profile.kind === 'employee' ? catalog.filter((item) => item.owner === profile.department) : catalog; }

  function updateRolePicker() {
    const kind = $('role-form').elements.role.value;
    const hasDepartment = ['employee', 'manager'].includes(kind);
    $('role-department-label').hidden = !hasDepartment;
    $('role-person-label').hidden = kind !== 'employee';
    const ids = kind === 'manager' ? managerDepartments : employeeDepartments;
    options($('role-department'), ids.map((id) => [id, departmentById.get(id).name]), ids.includes(profile.department) ? profile.department : kind === 'manager' ? 'kt' : 'ht');
    const notes = {
      employee: 'Chỉ thấy hồ sơ được giao cho người dùng mẫu trong phòng/Ban đã chọn. Hoàn thiện giấy tờ rồi trình kiểm tra.',
      clerk: 'Không gian tiếp nhận và lưu trữ dùng chung trong bản mẫu. Chỉ nhận nộp lưu hồ sơ đã qua bước kiểm tra.',
      manager: 'Chọn phòng, Ban hoặc đầu mối cụ thể. Phân công và kiểm tra trong phạm vi đơn vị đó; chức danh của đầu mối khác cần xác nhận khi triển khai.',
      chair: 'Theo dõi hồ sơ UBND và việc được trình xin ý kiến. Hồ sơ số hóa thường lệ không bắt buộc đi qua Chủ tịch.',
      council: 'Không gian HĐND: kỳ họp, thẩm tra, giám sát, kiến nghị. Ý kiến trên phần mềm không thay quyết định tập thể hoặc biểu quyết của HĐND.'
    };
    $('role-selection-note').textContent = notes[kind];
  }
  function openRolePicker() {
    $('role-form').elements.role.value = profile.kind; $('role-person').value = profile.user;
    updateRolePicker(); $('close-role-picker').hidden = !roleChosen; showDialog('role-dialog');
  }
  function applyRole() {
    const titles = { employee: 'Hồ sơ được giao', clerk: 'Tiếp nhận & nộp lưu', manager: 'Điều hành phòng / Ban', chair: 'Không gian Chủ tịch UBND', council: 'Không gian lãnh đạo HĐND' };
    const descriptions = { employee: 'Hoàn thiện từng giấy tờ, xử lý yêu cầu bổ sung và trình người phụ trách.', clerk: 'Kiểm tra bàn giao, quản lý vị trí bản giấy và tiếp nhận gói hồ sơ số.', manager: 'Giao đúng người, theo dõi thời hạn và kiểm tra hồ sơ trước khi chuyển bước.', chair: 'Nắm tiến độ theo phòng, xem việc trình và ghi ý kiến chỉ đạo.', council: 'Theo dõi bộ tài liệu kỳ họp, thẩm tra, giám sát và kết quả kiến nghị cử tri.' };
    $('role-page-title').textContent = profile.kind === 'manager' ? (['bkt', 'bvx'].includes(profile.department) ? 'Hồ sơ Ban HĐND' : ['mc', 'qp'].includes(profile.department) ? 'Hồ sơ đơn vị phụ trách' : 'Hồ sơ phòng chuyên môn') : titles[profile.kind]; $('role-page-description').textContent = descriptions[profile.kind];
    $('current-role-label').textContent = profile.kind === 'manager' ? (['bkt', 'bvx'].includes(profile.department) ? 'Trưởng Ban HĐND' : ['mc', 'qp'].includes(profile.department) ? 'Phụ trách đơn vị · mẫu' : 'Trưởng phòng UBND') : roleNames[profile.kind];
    $('current-role-scope').textContent = profile.department ? departmentById.get(profile.department).name : profile.kind === 'clerk' ? 'Kho hồ sơ được phân công · mẫu' : profile.kind === 'chair' ? 'Khối UBND' : 'Khối HĐND';
    $('role-avatar').textContent = ({ employee: 'CV', clerk: 'VT', manager: 'TP', chair: 'CT', council: 'HĐ' })[profile.kind];
    $('nav-all-label').textContent = profile.kind === 'employee' ? 'Hồ sơ của tôi' : profile.kind === 'manager' ? 'Hồ sơ đơn vị' : 'Tổng hợp hồ sơ';
    $('nav-review-label').textContent = profile.kind === 'clerk' ? 'Chờ nộp lưu' : 'Đến lượt xử lý';
    $('role-work-title').textContent = profile.kind === 'employee' ? 'Bắt đầu từ hồ sơ được giao' : profile.kind === 'clerk' ? 'Tiếp nhận hồ sơ đủ điều kiện bàn giao' : profile.kind === 'manager' ? 'Kiểm tra hồ sơ đang chờ phòng / Ban' : 'Tập trung vào việc đã được trình';
    $('role-work-description').textContent = descriptions[profile.kind];
    $('role-context').innerHTML = `<strong>${escape(actorLabel())}</strong><span>Phạm vi và thao tác đang được mô phỏng trên trình duyệt. <a href="nghiep-vu-vai-tro.html">Xem ma trận nghiệp vụ ↗</a></span>`;
    $('load-scan').hidden = !canCreate(); $('new-case').hidden = !canCreate();
    $('reset-demo').hidden = profile.kind !== 'clerk';
    const ownerIds = [...new Set(scopedRecords().map((record) => categoryByCode.get(record.categoryCode).owner))];
    if (profile.department && !ownerIds.includes(profile.department)) ownerIds.push(profile.department);
    options($('filter-department'), [['', 'Trong phạm vi vai trò'], ...ownerIds.map((id) => [id, departmentById.get(id).name])]);
    clearFilters(); activeView = profile.kind === 'employee' ? 'all' : 'review'; renderList();
  }
  function renderRoleDashboard() {
    const visible = scopedRecords();
    if (profile.kind === 'employee' || profile.kind === 'clerk') { $('role-dashboard').hidden = true; return; }
    $('role-dashboard').hidden = false;
    const queue = visible.filter(needsAction);
    const heading = profile.kind === 'manager' ? 'Hồ sơ chờ kiểm tra tại đơn vị' : 'Việc đã trình cần cho ý kiến';
    const queueHTML = queue.length ? queue.slice(0, 4).map((record) => `<button class="priority-item" data-open-route="${escape(record.id)}"><span><b>${escape(record.title)}</b><small>${escape(deadlineLabel(record))}</small></span><span aria-hidden="true">↗</span></button>`).join('') : '<p class="dashboard-empty">Chưa có hồ sơ đến lượt xử lý. Các hồ sơ đang chuẩn bị vẫn có trong danh sách tổng hợp.</p>';
    const topics = profile.kind === 'council' ? [
      ['meeting', 'Kỳ họp & nghị quyết', ['H01', 'H02']], ['appraisal', 'Thẩm tra các Ban', ['H03', 'H04']], ['oversight', 'Giám sát & kiến nghị', ['H05', 'H06', 'H07', 'H08']]
    ] : [...new Set(visible.map((record) => categoryByCode.get(record.categoryCode).owner))].map((id) => [id, departmentById.get(id).name, catalog.filter((item) => item.owner === id).map((item) => item.code)]);
    $('role-dashboard').innerHTML = `<article class="dashboard-panel"><div class="dashboard-title"><h3>${heading}</h3><span>${queue.length} hồ sơ</span></div>${queueHTML}</article><article class="dashboard-panel"><div class="dashboard-title"><h3>${profile.kind === 'council' ? 'Theo hoạt động HĐND' : 'Phạm vi theo dõi'}</h3></div><div class="topic-list">${topics.map(([key, label, codes]) => `<button data-topic="${key}"><span>${escape(label)}</span><b>${visible.filter((record) => codes.includes(record.categoryCode)).length}</b></button>`).join('')}</div><p class="form-hint">${profile.kind === 'council' ? 'Theo dõi thành phần và tiến độ hồ sơ; không thay chức năng biểu quyết tại kỳ họp.' : 'Số liệu thuộc bộ hồ sơ thí điểm, theo phạm vi của vai trò đang chọn.'}</p></article>`;
  }
  function compositionHTML(category, record = null) {
    const documents = record?.documents || [];
    const ordinary = category.documentTypes.map((type) => {
      const existing = documents.filter((doc) => doc.typeId === type.id);
      return `<details class="composition-item"><summary><span>${escape(type.name)}</span><small>${existing.length ? `Đã có ${existing.length}` : 'Chưa thêm'}</small></summary><div><p><b>Đầu mối hồ sơ:</b> ${escape(category.departmentName)}</p><p><b>Trường cần nhập hoặc đọc nếu có:</b> ${escape(type.fields.join(' · '))}</p>${record && canEdit(record) && !classificationDirty ? `<button class="button secondary compact" type="button" data-add-type="${type.id}">Thêm loại giấy tờ này</button>` : ''}</div></details>`;
    }).join('');
    const retained = documents.filter((doc) => !category.documentTypes.some((type) => type.id === doc.typeId));
    return `<p class="composition-hint">${category.documentTypes.length} loại giấy tờ để đối chiếu. Thành phần thực tế phụ thuộc vụ việc; không mặc định phải đủ mọi mục.</p>${ordinary}${retained.length ? `<div class="retained-documents"><strong>Giấy tờ đã có từ nhóm khác (${retained.length})</strong><p>Giữ nguyên bản quét, loại giấy tờ và dữ liệu gốc; kiểm tra lại sự phù hợp với nhóm đang chọn.</p><ul>${retained.map((doc) => `<li>${escape(doc.name)} · ${escape(categoryByCode.get(documentTypeById.get(doc.typeId).categoryCode).title)}</li>`).join('')}</ul></div>` : ''}`;
  }
  function fillEditDepartments(selectedOwner = '', selectedCategory = '') {
    const list = availableCategories().filter((item) => item.group === $('edit-group').value);
    const ids = [...new Set(list.map((item) => item.owner))];
    options($('edit-department'), ids.map((id) => [id, departmentById.get(id).name]), selectedOwner);
    fillEditCategories(selectedCategory);
  }
  function fillEditCategories(selected = '') {
    options($('edit-category'), availableCategories().filter((item) => item.group === $('edit-group').value && item.owner === $('edit-department').value).map((item) => [item.code, item.title]), selected);
    updateComposition();
  }
  function updateComposition() {
    const record = currentRecord(), category = categoryByCode.get($('edit-category').value);
    if (!record || !category) return;
    classificationDirty = record.categoryCode !== category.code;
    $('classification-note').hidden = !classificationDirty;
    $('classification-note').textContent = 'Đang xem bộ giấy tờ của nhóm mới. Bấm “Lưu thông tin” để áp dụng; giấy tờ đã có được giữ lại và cần kiểm tra lại.';
    $('case-department-detail').textContent = `${category.departmentName}. ${category.responsibility}`;
    $('case-type-list').innerHTML = compositionHTML(category, record);
    $('archive-case').disabled = classificationDirty || !canArchive(record);
  }
  function renderRouting() {
    const record = currentRecord(), category = categoryByCode.get(record.categoryCode), step = workflow(record);
    $('route-summary').innerHTML = `${flowBadge(record)}<h3>${escape(record.title)}</h3><p>${escape(category.departmentName)} · ${record.assignee === 'cv-02' ? 'Chuyên viên 02' : 'Chuyên viên 01'} · ${escape(deadlineLabel(record))}</p>`;
    const position = ({ draft: 0, returned: 0, department_review: 1, leadership_review: 2, ready_archive: 3, archived: 4 })[step];
    $('route-steps').innerHTML = ['Chuẩn bị', 'Phòng / Ban kiểm tra', 'Xin ý kiến nếu cần', 'Tiếp nhận nộp lưu', 'Lưu trữ'].map((label, i) => `<li class="${i === position ? 'current' : i < position ? 'passed' : ''}"><span>${i + 1}</span>${label}</li>`).join('');
    $('route-overview').innerHTML = `<div><strong>${record.documents.length}</strong><span>giấy tờ đã thêm</span></div><div><strong>${record.documents.filter((doc) => doc.reviewed).length}</strong><span>đã đối chiếu dữ liệu</span></div><div><strong>${record.documents.filter((doc) => !doc.reviewed).length}</strong><span>cần kiểm tra</span></div>${record.workflowNote ? `<p class="routing-note"><b>Ý kiến gần nhất:</b> ${escape(record.workflowNote)}</p>` : ''}`;
    $('assignment-form').hidden = !canAssign(record);
    $('assignment-person').value = record.assignee || 'cv-01'; $('assignment-due').value = record.dueDate || '';
    const actions = [];
    if (canEdit(record)) actions.push(['submit', 'Trình kiểm tra hồ sơ', !allVerified(record)]);
    if (canManage(record)) actions.push(['accept', 'Hoàn tất kiểm tra', !allVerified(record)], ['escalate', 'Trình xin ý kiến lãnh đạo', !allVerified(record)], ['return', 'Yêu cầu bổ sung', false]);
    if (canDecide(record)) actions.push(['decide', 'Ghi ý kiến hoàn tất', !allVerified(record)], ['return', 'Yêu cầu hoàn thiện lại', false]);
    if (canArchive(record)) actions.push(['archive', 'Tiếp nhận nộp lưu mẫu', false], ['return', 'Trả bổ sung gói nộp lưu', false]);
    $('decision-form').hidden = !actions.length;
    $('decision-note').value = '';
    $('decision-title').textContent = canDecide(record) ? 'Ý kiến đối với hồ sơ được trình' : canManage(record) ? 'Kết quả kiểm tra của phòng / Ban' : canArchive(record) ? 'Kết quả kiểm tra bàn giao' : 'Trình hồ sơ đã hoàn thiện';
    $('decision-actions').innerHTML = actions.map(([action, label, disabled], i) => `<button class="button ${i === 0 ? 'primary' : 'secondary'}" type="button" data-route-action="${action}" ${disabled ? 'disabled' : ''}>${label}</button>`).join('');
    $('decision-hint').textContent = canDecide(record) ? 'Thao tác ghi nhận ý kiến trong bản thí điểm; chưa ký số, ban hành văn bản hay biểu quyết nghị quyết.' : 'Chỉ chuyển bước khi từng giấy tờ đã được đối chiếu. Mốc hạn là hạn nội bộ do người giao việc đặt.';
  }
  function performRouteAction(action) {
    const record = currentRecord(); if (!record || !inScope(record)) return;
    const note = $('decision-note').value.trim();
    let next, message;
    if (action === 'submit' && canEdit(record) && allVerified(record)) { next = ['tt', 'db'].includes(categoryByCode.get(record.categoryCode).owner) ? 'leadership_review' : 'department_review'; message = 'Trình hồ sơ đã đối chiếu để người phụ trách kiểm tra.'; }
    if (action === 'accept' && canManage(record) && allVerified(record)) { next = 'ready_archive'; message = 'Hoàn tất kiểm tra hồ sơ; chuyển văn thư/lưu trữ kiểm tra bàn giao.'; }
    if (action === 'escalate' && canManage(record) && allVerified(record)) { next = 'leadership_review'; message = 'Trình hồ sơ xin ý kiến lãnh đạo theo phạm vi công việc.'; }
    if (action === 'decide' && canDecide(record) && allVerified(record)) { next = 'ready_archive'; message = 'Ghi ý kiến hoàn tất hồ sơ trong bản thí điểm; chuyển kiểm tra bàn giao.'; }
    if (action === 'archive' && canArchive(record)) { next = 'archived'; message = 'Tiếp nhận nộp lưu hồ sơ mẫu; chưa kết nối kho lưu trữ cơ quan.'; }
    if (action === 'return' && (canManage(record) || canDecide(record) || canArchive(record))) {
      next = canDecide(record) && managerDepartments.includes(categoryByCode.get(record.categoryCode).owner) ? 'department_review' : 'returned';
      message = 'Yêu cầu bổ sung, hoàn thiện hồ sơ.';
    }
    if (!next || classificationDirty || reviewDirty) return;
    if (['return', 'escalate', 'decide'].includes(action) && note.length < 10) { notify('Ghi rõ ý kiến hoặc yêu cầu xử lý, tối thiểu 10 ký tự.'); $('decision-note').focus(); return; }
    record.workflow = next; record.status = next === 'archived' ? 'archived' : 'review';
    if (next === 'returned') record.documents.forEach((doc) => { doc.reviewed = false; });
    record.workflowNote = note || message;
    touch(record, `${message}${note ? ` Ý kiến: ${note}` : ''}`); renderCase(); setTab('routing'); notify(flowNames[next]);
  }

  function notify(message) {
    const toast = $('toast');
    const dialogs = [...document.querySelectorAll('dialog[open]')];
    (dialogs.at(-1) || document.body).append(toast);
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
  }
  function showDialog(id) {
    if (!$(id).open) $(id).showModal();
    document.body.classList.add('modal-open');
  }
  function options(select, entries, selected = '') {
    select.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
    if (entries.some(([value]) => value === selected)) select.value = selected;
  }
  function sampleValue(label, typeName, order) {
    if (/ngày|thời hạn|kỳ lập/i.test(label)) return '08/11/2026';
    if (/số tiền|giá trị/i.test(label)) return '1.250.000';
    if (/tiền tệ/i.test(label)) return 'VND';
    if (/số\/ký|số hợp đồng|số chứng từ/i.test(label)) return `${String(order + 1).padStart(3, '0')}/MH`;
    if (/người |bên ký|tham gia/i.test(label)) return 'Người tham gia minh họa';
    if (/cơ quan|đơn vị/i.test(label)) return 'Đơn vị minh họa';
    if (/số trang|số tờ/i.test(label)) return '3';
    if (/địa điểm|vị trí/i.test(label)) return 'Địa điểm mẫu số 01';
    if (/tài liệu liên quan|kèm theo/i.test(label)) return 'Theo danh mục giấy tờ kèm hồ sơ mẫu';
    return `${typeName} — nội dung minh họa`;
  }
  function makeDocument(category, index, state, sequence = 0) {
    const type = category.documentTypes[index % category.documentTypes.length];
    const sourceValues = type.fields.map((label) => sampleValue(label, type.name, sequence + index));
    return {
      id: uid(), typeId: type.id, name: type.name, direction: index === 0 ? 'Đến' : 'Nội bộ', sample: true,
      fileName: `Mau_${category.code}_${index + 1}.pdf`, fileType: 'sample', reviewed: state === 'archived',
      sourceValues,
      fields: type.fields.map((label, i) => ({ label, value: state === 'received' || (state === 'review' && i === type.fields.length - 1) ? '' : sourceValues[i], uncertain: state !== 'archived' && i === type.fields.length - 1 }))
    };
  }
  function seedRecords() {
    const seeds = [
      ['U15', 'Đăng ký biến động đất đai · Lô mẫu 01', 'review'],
      ['H01', 'Tổ chức kỳ họp HĐND · Bộ mẫu tháng 11', 'archived'],
      ['U11', 'Chứng từ ngân sách · Bộ mẫu quý IV', 'review'],
      ['U08', 'Đăng ký khai sinh · Lô mẫu 02', 'archived'],
      ['U02', 'Phiên họp UBND · Bộ mẫu tháng 11', 'received'],
      ['H05', 'Giám sát chuyên đề · Bộ hồ sơ mẫu 01', 'review'],
      ['U22', 'Kiểm tra an toàn thực phẩm · Đợt mẫu 03', 'archived'],
      ['U13', 'Theo dõi đầu tư công · Dự án minh họa', 'received'],
      ['H07', 'Kiến nghị cử tri · Đợt tiếp xúc mẫu', 'review'],
      ['U05', 'Bổ nhiệm cán bộ · Bộ hồ sơ minh họa', 'archived'],
      ['U19', 'Kiểm tra môi trường · Cơ sở minh họa', 'received'],
      ['H03', 'Thẩm tra ngân sách · Bộ tài liệu mẫu', 'received']
    ];
    return seeds.map(([categoryCode, title, status], i) => {
      const category = categoryByCode.get(categoryCode);
      const updatedAt = `2026-11-${String(11 - Math.floor(i / 3)).padStart(2, '0')}T${String(9 + i % 3).padStart(2, '0')}:00:00+07:00`;
      const step = ({ U11: 'department_review', U13: 'leadership_review', H03: 'department_review', H05: 'leadership_review', H07: 'leadership_review', U02: 'ready_archive', U19: 'returned' })[categoryCode] || (status === 'archived' ? 'archived' : 'draft');
      const completed = ['department_review', 'leadership_review', 'ready_archive', 'archived'].includes(step);
      return { id: uid(), code: `HS-2026-${String(i + 1).padStart(4, '0')}`, title, categoryCode, year: 2026, workflow: step, assignee: 'cv-01', dueDate: '2026-11-18', workflowNote: step === 'returned' ? 'Bổ sung bản quét rõ các trang và đối chiếu lại thông tin trước khi trình.' : 'Tình huống nghiệp vụ giả lập để trải nghiệm theo vai trò.',
        location: `Kho mẫu · Tủ ${1 + i % 3} · Hộp ${String(i + 1).padStart(2, '0')}`, notes: 'Hồ sơ giả lập để trải nghiệm giao diện, không phải hồ sơ thực tế của cơ quan.', status, updatedAt,
        documents: [0, 1, 2].map((n) => makeDocument(category, n, completed ? 'archived' : status, i)),
        history: [{ at: updatedAt, text: 'Khởi tạo bộ hồ sơ và giấy tờ minh họa.' }, ...(status === 'archived' ? [{ at: updatedAt, text: 'Hồ sơ mẫu đã được xác nhận và lưu trữ để minh họa trạng thái.' }] : [])]
      };
    });
  }
  function validRecord(record) {
    const category = categoryByCode.get(record?.categoryCode);
    return category && typeof record.id === 'string' && typeof record.code === 'string' && typeof record.title === 'string'
      && Object.hasOwn(statusNames, record.status) && Number.isFinite(new Date(record.updatedAt).getTime())
      && Number.isInteger(record.year) && typeof record.location === 'string' && typeof record.notes === 'string'
      && Array.isArray(record.history) && record.history.every((entry) => typeof entry.text === 'string' && Number.isFinite(new Date(entry.at).getTime()))
      && Array.isArray(record.documents) && record.documents.every((doc) => typeof doc.id === 'string' && typeof doc.name === 'string'
        && documentTypeById.has(doc.typeId) && typeof doc.reviewed === 'boolean'
        && Array.isArray(doc.sourceValues) && Array.isArray(doc.fields) && doc.fields.every((field) => typeof field.label === 'string' && typeof field.value === 'string'));
  }
  function loadRecords() {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return seedRecords();
      const data = JSON.parse(stored);
      if (data.version !== 1 || !Array.isArray(data.records) || !data.records.every(validRecord)) throw new Error('Invalid saved data');
      return data.records;
    } catch {
      storageWorks = false;
      $('save-state').textContent = 'Không đọc được dữ liệu cục bộ. Đang dùng bộ mẫu trong phiên này; xuất dữ liệu trước khi đóng.';
      return seedRecords();
    }
  }
  let records = loadRecords();
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, records }));
      storageWorks = true;
      $('save-state').textContent = 'Thông tin hồ sơ lưu trên trình duyệt · PDF nhập từ danh sách scan được giữ tại dịch vụ local.';
    } catch {
      storageWorks = false;
      $('save-state').textContent = 'Chưa lưu được trên trình duyệt. Dữ liệu đang giữ trong phiên; hãy xuất danh sách.';
      notify('Trình duyệt chưa lưu được dữ liệu. Hãy xuất danh sách trước khi đóng trang.');
    }
  }
  function touch(record, message) {
    record.updatedAt = new Date().toISOString();
    record.history.push({ at: record.updatedAt, text: `${actorLabel()}: ${message}` });
    save(); renderList();
  }
  function currentRecord() { return records.find((record) => record.id === activeId); }
  function currentDocument() { return currentRecord()?.documents.find((doc) => doc.id === activeDocId); }
  function filteredRecords() {
    const query = normalize($('record-search').value.trim());
    return scopedRecords().filter((record) => {
      const category = categoryByCode.get(record.categoryCode);
      return (!$('filter-group').value || category.group === $('filter-group').value)
        && (!$('filter-department').value || category.owner === $('filter-department').value)
        && (!$('filter-status').value || workflow(record) === $('filter-status').value)
        && (activeView !== 'review' || needsAction(record))
        && (activeView !== 'received' || ['draft', 'returned'].includes(workflow(record)))
        && (activeView !== 'archived' || workflow(record) === 'archived')
        && (!topicFilter || (profile.kind === 'council' ? ({ meeting: ['H01', 'H02'], appraisal: ['H03', 'H04'], oversight: ['H05', 'H06', 'H07', 'H08'] })[topicFilter]?.includes(record.categoryCode) : category.owner === topicFilter))
        && normalize([record.code, record.title, category.title, category.departmentName, ...record.documents.map((doc) => doc.name)].join(' ')).includes(query);
    }).sort((a, b) => (new Date(b.updatedAt) - new Date(a.updatedAt)) * (sortDescending ? 1 : -1));
  }
  function renderList() {
    const result = filteredRecords();
    const pageCount = Math.max(1, Math.ceil(result.length / pageSize));
    pageNumber = Math.max(1, Math.min(pageNumber, pageCount));
    const view = result.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    $('case-rows').innerHTML = view.map((record) => {
      const category = categoryByCode.get(record.categoryCode);
      return `<tr><td><div class="record-title"><span class="file-mark">${icon('folder')}</span><div><button data-open-case="${escape(record.id)}">${escape(record.title)}</button><small>${escape(record.code)} · ${escape(category.group)} · ${record.year}</small></div></div></td><td><div class="record-dept">${escape(category.departmentName)}<small>${escape(category.title)}</small></div></td><td><span class="count-docs">${record.documents.length} giấy tờ</span></td><td>${flowBadge(record)}<small class="deadline-caption">${escape(deadlineLabel(record))}</small></td><td class="date-cell">${date(record.updatedAt)}</td><td><button class="row-open" data-open-case="${escape(record.id)}" aria-label="Mở ${escape(record.code)}">↗</button></td></tr>`;
    }).join('');
    $('list-title').textContent = ({ all: 'Danh sách hồ sơ', review: 'Hồ sơ đến lượt xử lý', received: 'Hồ sơ đang chuẩn bị / bổ sung', archived: 'Hồ sơ đã lưu trữ' })[activeView];
    $('result-count').textContent = `${result.length} hồ sơ`;
    $('empty-records').hidden = result.length > 0;
    $('page-caption').textContent = result.length ? `Hiển thị ${(pageNumber - 1) * pageSize + 1}–${Math.min(pageNumber * pageSize, result.length)} / ${result.length} hồ sơ` : '0 hồ sơ';
    $('page-number').textContent = `${pageNumber} / ${pageCount}`;
    $('prev-page').disabled = pageNumber <= 1; $('next-page').disabled = pageNumber >= pageCount;
    const visible = scopedRecords();
    $('stat-all').textContent = visible.length; $('nav-all').textContent = visible.length;
    $('stat-docs').textContent = `${visible.reduce((sum, record) => sum + record.documents.length, 0)} giấy tờ trong phạm vi vai trò`;
    $('stat-received').textContent = visible.filter((record) => ['draft', 'returned'].includes(workflow(record))).length;
    $('stat-review').textContent = visible.filter(needsAction).length; $('nav-review').textContent = visible.filter(needsAction).length;
    $('stat-archived').textContent = visible.filter((record) => workflow(record) === 'archived').length;
    $('nav-archived').textContent = $('stat-archived').textContent;
    document.querySelectorAll('[data-view]').forEach((button) => {
      const active = button.dataset.view === activeView;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    renderRoleDashboard();
  }

  function clearFilters() {
    ['record-search', 'filter-group', 'filter-department', 'filter-status'].forEach((id) => { $(id).value = ''; });
    pageNumber = 1; activeView = 'all'; topicFilter = ''; renderList();
  }
  function setView(status) { clearFilters(); activeView = status; renderList(); }
  function setTab(name) {
    if (classificationDirty && name !== 'info') { notify('Lưu lựa chọn phòng/ban và nhóm công việc trước khi chuyển tab.'); $('save-info').focus(); return; }
    document.querySelectorAll('[data-tab]').forEach((button) => {
      const selected = button.dataset.tab === name;
      button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
      $(`panel-${button.dataset.tab}`).hidden = !selected;
    });
  }
  function renderCase() {
    const record = currentRecord(); if (!record || !inScope(record)) return;
    classificationDirty = false;
    const category = categoryByCode.get(record.categoryCode);
    $('case-code').textContent = `${record.code} · ${category.group} · ${record.year}`;
    $('case-title').textContent = record.title;
    $('case-summary').innerHTML = `${flowBadge(record)}<span>${escape(category.departmentName)}</span>`;
    $('edit-title').value = record.title; $('edit-year').value = record.year;
    const editGroups = [...new Set((canEdit(record) ? availableCategories() : catalog).map((item) => item.group))];
    options($('edit-group'), editGroups.map((group) => [group, group]), category.group);
    if (canEdit(record)) fillEditDepartments(category.owner, category.code);
    else { options($('edit-department'), [[category.owner, category.departmentName]]); options($('edit-category'), [[category.code, category.title]]); }
    $('edit-location').value = record.location; $('edit-notes').value = record.notes;
    const archived = workflow(record) === 'archived';
    ['edit-title', 'edit-group', 'edit-department', 'edit-category', 'edit-year', 'edit-location', 'edit-notes', 'save-info', 'add-document'].forEach((id) => { $(id).disabled = !canEdit(record); });
    $('add-document-form').hidden = true;
    updateComposition();
    $('document-list').innerHTML = record.documents.length ? record.documents.map((doc) => `<div class="document-item"><span class="file-mark">${icon('scan')}</span><div><h4>${escape(doc.name)}</h4><small>${escape(documentTypeById.get(doc.typeId).name)} · Luân chuyển: ${escape(doc.direction)}</small><div>${doc.reviewed ? '<span class="status archived">Đã xác nhận</span>' : '<span class="status review">Chờ kiểm tra</span>'}</div></div><button class="button secondary compact" data-review-doc="${escape(doc.id)}">${doc.reviewed ? 'Xem giấy tờ' : 'Kiểm tra →'}</button></div>`).join('') : '<div class="empty-state"><h3>Hồ sơ chưa có giấy tờ</h3><p>Thêm từng loại giấy tờ theo danh mục nghiệp vụ.</p></div>';
    options($('document-type'), category.documentTypes.map((type) => [type.id, type.name]));
    if (!record.documents.some((doc) => doc.id === activeDocId)) activeDocId = record.documents[0]?.id || null;
    options($('review-document'), record.documents.map((doc) => [doc.id, `${doc.name}${doc.reviewed ? ' · Đã xác nhận' : ''}`]), activeDocId);
    $('history-list').innerHTML = [...record.history].reverse().map((entry) => `<li><time>${date(entry.at, true)}</time>${escape(entry.text)}</li>`).join('');
    const approved = record.documents.filter((doc) => doc.reviewed).length;
    $('case-progress').textContent = `${approved} / ${record.documents.length} giấy tờ đã xác nhận · Thao tác thí điểm`;
    $('archive-case').hidden = profile.kind !== 'clerk' || archived;
    $('archive-case').disabled = !canArchive(record);
    $('reopen-case').hidden = !archived || profile.kind !== 'clerk';
    renderReview(); renderRouting();
  }
  function openCase(id, tab = null) {
    const record = records.find((item) => item.id === id); if (!record || !inScope(record)) return;
    activeId = id; activeDocId = null; renderCase(); setTab(tab || (profile.kind === 'employee' ? 'info' : 'routing')); showDialog('case-dialog');
    $('case-dialog').querySelector('.case-content').scrollTop = 0;
  }
  function renderReview() {
    reviewDirty = false;
    const record = currentRecord(), doc = currentDocument();
    $('review-empty').hidden = !!doc; $('review-workspace').hidden = !doc;
    $('review-document').disabled = !doc;
    const canRunSample = record.documents.length > 0 && record.documents.every((item) => item.sample) && canEdit(record);
    $('run-ai').disabled = !canRunSample;
    $('review-help').textContent = !canEdit(record) ? 'Đang xem để đối chiếu. Việc chỉnh sửa dữ liệu thuộc bước chuẩn bị của cán bộ được giao.' : doc?.sourceDocumentId ? 'PDF đã được tiếp nhận từ danh sách scan. Đối chiếu thông tin đã đọc với bản gốc lưu trên máy.' : canRunSample ? 'Chạy thử trên giấy tờ giả lập; không thực hiện OCR thật.' : 'Với tệp tự chọn, nhập thủ công hoặc mở danh sách PDF để đọc bằng AI local.';
    if (!doc) return;
    const type = documentTypeById.get(doc.typeId);
    $('preview-name').textContent = doc.fileName || doc.name;
    const file = sessionFiles.get(doc.id);
    if (file) {
      $('document-preview').innerHTML = file.type === 'application/pdf' ? `<iframe class="uploaded-pdf" title="Bản PDF được chọn trong phiên" src="${file.url}"></iframe>` : `<img class="uploaded-image" src="${file.url}" alt="Bản quét được chọn trong phiên">`;
    } else if (doc.sourceDocumentId) {
      $('document-preview').innerHTML = `<iframe class="uploaded-pdf" title="PDF gốc lưu trên máy" src="/api/sam3/documents/${encodeURIComponent(doc.sourceDocumentId)}/file"></iframe>`;
    } else if (doc.sample) {
      $('document-preview').innerHTML = `<article class="sample-paper"><div class="paper-stamp">GIẤY TỜ MINH HỌA · KHÔNG PHẢI VĂN BẢN THẬT</div><h4>${escape(type.name)}</h4>${doc.fields.map((field, i) => `<p data-source-field="${i}"><strong>${escape(field.label)}:</strong> ${escape(doc.sourceValues[i] || 'Không có thông tin')}</p>`).join('')}<div class="paper-end">Trang mẫu 1 / 1</div></article>`;
    } else {
      $('document-preview').innerHTML = `<div class="file-unavailable">${doc.fileName ? 'Tệp chỉ có trong phiên trước. Chọn lại bản quét để xem và đối chiếu.' : 'Chưa chọn bản quét. Chọn tệp PDF, PNG hoặc JPG để xem tại đây.'}</div>`;
    }
    const locked = !canEdit(record);
    $('extracted-fields').innerHTML = doc.fields.map((field, i) => `<label class="extracted-field${field.uncertain ? ' needs-review' : ''}"><span class="field-caption"><span>${escape(field.label)}</span>${field.uncertain ? '<span class="field-warning">CẦN KIỂM TRA</span>' : ''}</span><input data-field="${i}" value="${escape(field.value)}" maxlength="2000" ${locked ? 'disabled' : ''}><small>${doc.sample ? `Vùng nguồn minh họa ${i + 1} · Trang 1` : doc.sourceDocumentId ? 'Dữ liệu tiếp nhận từ PDF local; kiểm tra với bản gốc' : 'Nhập theo bản quét đã đối chiếu; chưa có kết quả OCR tự động'}</small></label>`).join('');
    $('verify-document').checked = doc.reviewed; $('verify-document').disabled = locked;
    ['save-draft', 'approve-document', 'attach-file'].forEach((id) => { $(id).disabled = locked; });
    $('approve-document').textContent = doc.reviewed ? 'Cập nhật xác nhận' : 'Xác nhận giấy tờ';
    $('attach-file').value = '';
  }
  function fillDepartmentSelect() {
    const available = [...new Set(availableCategories().filter((item) => item.group === $('new-group').value).map((item) => item.owner))];
    options($('new-department'), available.map((id) => [id, departmentById.get(id).name]));
    fillCategorySelect();
  }
  function fillCategorySelect(selected = '') {
    options($('new-category'), availableCategories().filter((item) => item.group === $('new-group').value && item.owner === $('new-department').value).map((item) => [item.code, item.title]), selected);
    updateTypePreview();
  }
  function updateTypePreview() {
    const category = categoryByCode.get($('new-category').value);
    $('new-type-preview').innerHTML = `<p class="composition-hint"><b>${escape(category.departmentName)}</b><br>${escape(category.responsibility)}</p>${compositionHTML(category)}`;
  }
  function openNew(categoryCode) {
    if (!canCreate()) return;
    $('new-form').reset();
    const groups = [...new Set(availableCategories().map((item) => item.group))];
    options($('new-group'), groups.map((group) => [group, group])); fillDepartmentSelect();
    if (categoryCode && availableCategories().some((item) => item.code === categoryCode)) {
      const category = categoryByCode.get(categoryCode);
      $('new-group').value = category.group; fillDepartmentSelect(); $('new-department').value = category.owner; fillCategorySelect(categoryCode);
    }
    showDialog('new-dialog'); $('new-name').focus();
  }
  function nextCode() {
    const max = records.reduce((value, record) => Math.max(value, Number(record.code.match(/-(\d+)$/)?.[1] || 0)), 0);
    return `HS-2026-${String(max + 1).padStart(4, '0')}`;
  }
  function addScanSample() {
    if (!canCreate()) return;
    const category = profile.kind === 'employee' ? availableCategories()[0] : categoryByCode.get('U15');
    const now = new Date().toISOString();
    const record = { id: uid(), code: nextCode(), title: `${category.title} · Lô scan mẫu`, categoryCode: category.code, year: 2026, location: 'Hộp mẫu · Chờ đối chiếu vị trí', notes: 'Lô giả lập để thử AI phân tách, đọc trường và duyệt giấy tờ.', status: 'received', updatedAt: now, workflow: 'draft', assignee: profile.user, dueDate: '', documents: [0, 1, 2].map((index) => makeDocument(category, index, 'received')), history: [{ at: now, text: 'Nạp 3 giấy tờ mẫu theo danh mục nhóm công việc. Tách tài liệu và nội dung là mô phỏng.' }] };
    records.unshift(record); save(); clearFilters(); openCase(record.id, 'review'); notify('Đã nạp 3 giấy tờ mẫu. Bấm “Chạy AI mẫu” để trải nghiệm.');
  }
  function saveReview(approve) {
    const record = currentRecord(), doc = currentDocument(); if (!doc || !canEdit(record)) return;
    const inputs = [...$('extracted-fields').querySelectorAll('[data-field]')];
    if (approve && inputs.some((input) => !input.value.trim())) {
      notify('Còn trường trống. Điền theo nguồn hoặc ghi “Không có trên tài liệu” sau khi kiểm tra.');
      inputs.find((input) => !input.value.trim()).focus(); return;
    }
    if (approve && !doc.sample && !doc.sourceDocumentId && !sessionFiles.has(doc.id)) { notify('Chọn bản quét để đối chiếu trước khi xác nhận giấy tờ.'); return; }
    doc.fields.forEach((field, i) => { field.value = inputs[i].value.trim(); if (approve) field.uncertain = false; });
    doc.reviewed = approve; record.status = 'review';
    touch(record, `${approve ? 'Xác nhận' : 'Lưu nháp'} giấy tờ: ${doc.name}.`);
    renderCase(); setTab('review'); notify(approve ? 'Đã xác nhận giấy tờ trong bản thí điểm.' : 'Đã lưu nháp dữ liệu giấy tờ.');
  }
  function renderCategories() {
    const owner = $('category-department').value;
    const list = catalog.filter((item) => item.owner === owner);
    $('category-list').innerHTML = list.map((item) => `<details><summary>${escape(item.title)}<small>${item.code} · ${item.documentTypes.length} loại giấy tờ</small></summary><ul class="category-docs">${item.documentTypes.map((type) => `<li><strong>${escape(type.name)}</strong><small>Trường cần đọc/nhập: ${escape(type.fields.join(' · '))}</small></li>`).join('')}</ul><p class="form-hint">${escape(item.responsibility)}</p>${canCreate() && availableCategories().includes(item) ? `<button class="button secondary compact" data-create-category="${item.code}">Tạo hồ sơ thuộc nhóm này →</button>` : ''}</details>`).join('');
  }

  // Navigation and filters.
  options($('filter-department'), [['', 'Tất cả phòng/ban'], ...departments.map((item) => [item.id, item.name])]);
  for (const id of ['record-search', 'filter-group', 'filter-department', 'filter-status']) $(id).addEventListener(id === 'record-search' ? 'input' : 'change', () => { pageNumber = 1; activeView = 'all'; topicFilter = ''; renderList(); });
  $('clear-filters').addEventListener('click', clearFilters); $('empty-reset').addEventListener('click', clearFilters);
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-metric]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.metric)));
  $('prev-page').addEventListener('click', () => { pageNumber--; renderList(); });
  $('next-page').addEventListener('click', () => { pageNumber++; renderList(); });
  $('sort-date').addEventListener('click', () => { sortDescending = !sortDescending; $('sort-date').textContent = `Cập nhật ${sortDescending ? '↓' : '↑'}`; renderList(); });
  $('case-rows').addEventListener('click', (event) => { const button = event.target.closest('[data-open-case]'); if (button) openCase(button.dataset.openCase); });
  $('load-scan').addEventListener('click', () => { location.href = 'scan-inbox.html'; });
  $('try-review').addEventListener('click', () => { const record = scopedRecords().find(needsAction); if (record) openCase(record.id, profile.kind === 'employee' ? 'review' : 'routing'); else { setView('review'); notify('Chưa có hồ sơ đến lượt xử lý của vai trò này.'); } });

  // Dialogs retain keyboard focus using the browser's native modal behavior.
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('close', () => {
      if (dialog.id === 'case-dialog' && reviewDirty) saveReview(false);
      if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    });
    dialog.addEventListener('click', (event) => { if (dialog.id === 'role-dialog' && !roleChosen) return; const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close(); });
  });
  document.querySelectorAll('[data-tab]').forEach((button) => {
    button.addEventListener('click', () => { if (reviewDirty && button.dataset.tab !== 'review') saveReview(false); setTab(button.dataset.tab); });
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const tabs = [...document.querySelectorAll('[data-tab]')]; const index = tabs.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      if (reviewDirty && tabs[next].dataset.tab !== 'review') saveReview(false);
      setTab(tabs[next].dataset.tab); tabs[next].focus();
    });
  });

  // The creation path is department -> work-file category -> individual document type.
  $('new-case').addEventListener('click', () => openNew());
  $('new-group').addEventListener('change', fillDepartmentSelect);
  $('new-department').addEventListener('change', () => fillCategorySelect());
  $('new-category').addEventListener('change', updateTypePreview);
  $('new-form').addEventListener('submit', (event) => {
    event.preventDefault(); if (!canCreate()) return;
    const title = $('new-name').value.trim(); if (!title) { $('new-name').focus(); return; }
    const now = new Date().toISOString();
    const record = { id: uid(), code: nextCode(), title, categoryCode: $('new-category').value, year: Number($('new-year').value), location: $('new-location').value.trim(), notes: '', status: 'received', workflow: 'draft', assignee: profile.user, dueDate: '', updatedAt: now, documents: [], history: [{ at: now, text: 'Tạo hồ sơ thí điểm và chọn phòng phụ trách, nhóm công việc.' }] };
    records.unshift(record); save(); clearFilters(); $('new-dialog').close(); openCase(record.id, 'documents'); notify('Đã tạo hồ sơ. Thêm từng loại giấy tờ vào hồ sơ này.');
  });
  $('info-form').addEventListener('submit', (event) => {
    event.preventDefault(); const record = currentRecord(); if (!canEdit(record)) return;
    const title = $('edit-title').value.trim(); if (!title) return;
    record.title = title; record.year = Number($('edit-year').value); record.location = $('edit-location').value.trim(); record.notes = $('edit-notes').value.trim();
    const selected = categoryByCode.get($('edit-category').value);
    if (!selected || !availableCategories().some((item) => item.code === selected.code)) return;
    const previous = categoryByCode.get(record.categoryCode), changed = selected.code !== record.categoryCode;
    record.categoryCode = selected.code;
    if (changed) { record.documents.forEach((doc) => { doc.reviewed = false; }); record.workflow = 'draft'; }
    touch(record, changed ? `Đổi nhóm công việc từ ${previous.title} sang ${selected.title}; đầu mối ${selected.departmentName}. Giữ nguyên các giấy tờ đã có để đối chiếu lại.` : 'Cập nhật tên, năm, vị trí bản giấy hoặc ghi chú hồ sơ.'); renderCase(); notify('Đã lưu thông tin hồ sơ.');
  });
  $('add-document').addEventListener('click', () => { $('add-document-form').hidden = false; $('document-type').focus(); });
  $('cancel-add-document').addEventListener('click', () => { $('add-document-form').hidden = true; });
  $('add-document-form').addEventListener('submit', (event) => {
    event.preventDefault(); const record = currentRecord(); if (!canEdit(record)) return;
    const type = categoryByCode.get(record.categoryCode).documentTypes.find((item) => item.id === $('document-type').value);
    const doc = { id: uid(), typeId: type.id, name: $('document-name').value.trim() || type.name, direction: $('document-direction').value, sample: false, fileName: '', fileType: '', reviewed: false, sourceValues: [], fields: type.fields.map((label) => ({ label, value: '', uncertain: true })) };
    record.documents.push(doc); record.status = 'review'; activeDocId = doc.id; $('document-name').value = '';
    touch(record, `Thêm loại giấy tờ: ${type.name}; hướng luân chuyển: ${doc.direction}.`); renderCase(); setTab('review'); notify('Đã thêm giấy tờ. Chọn bản quét và nhập thông tin để đối chiếu.');
  });
  $('document-list').addEventListener('click', (event) => { const button = event.target.closest('[data-review-doc]'); if (!button) return; activeDocId = button.dataset.reviewDoc; $('review-document').value = activeDocId; renderReview(); setTab('review'); });
  $('review-document').addEventListener('change', () => {
    const selectedId = $('review-document').value;
    if (reviewDirty) saveReview(false);
    activeDocId = selectedId; $('review-document').value = selectedId; renderReview();
  });
  $('run-ai').addEventListener('click', () => {
    const record = currentRecord(); if (!canEdit(record) || !record.documents.length || !record.documents.every((doc) => doc.sample)) return;
    for (const doc of record.documents) {
      if (doc.reviewed) continue;
      doc.fields.forEach((field, i) => { field.value = i === doc.fields.length - 1 ? '' : doc.sourceValues[i]; field.uncertain = i === doc.fields.length - 1; });
    }
    record.status = 'review'; touch(record, 'Chạy mô phỏng AI trên lô mẫu: tách tài liệu, gợi ý loại giấy tờ, điền trường và đánh dấu trường cần đối chiếu. Không gọi dịch vụ OCR.'); renderCase(); setTab('review'); notify('Đã mô phỏng kết quả AI. Đối chiếu trường trống với bản mẫu bên cạnh.');
  });
  $('extracted-fields').addEventListener('focusin', (event) => {
    const index = event.target.dataset.field;
    $('document-preview').querySelectorAll('[data-source-field]').forEach((line) => line.classList.toggle('highlight', line.dataset.sourceField === index));
  });
  $('extracted-fields').addEventListener('input', () => {
    reviewDirty = true; $('verify-document').checked = false; $('archive-case').disabled = true; $('run-ai').disabled = true;
    $('case-progress').textContent = 'Có thay đổi chưa xác nhận · Cần kiểm tra lại giấy tờ trước khi lưu trữ.';
  });
  $('review-form').addEventListener('submit', (event) => { event.preventDefault(); saveReview(true); });
  $('save-draft').addEventListener('click', () => saveReview(false));
  $('attach-file').addEventListener('change', () => {
    const file = $('attach-file').files[0], doc = currentDocument(), record = currentRecord();
    if (!file || !doc || !canEdit(record)) return;
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) { notify('Chọn PDF, PNG hoặc JPG tối đa 10 MB cho bản thí điểm.'); $('attach-file').value = ''; return; }
    if (sessionFiles.has(doc.id)) URL.revokeObjectURL(sessionFiles.get(doc.id).url);
    sessionFiles.set(doc.id, { url: URL.createObjectURL(file), type: file.type });
    doc.sample = false; doc.fileName = file.name; doc.fileType = file.type; doc.sourceValues = []; doc.reviewed = false;
    delete doc.sourceDocumentId; delete doc.sourceSha256; delete doc.extractionJobId;
    doc.fields.forEach((field) => { field.value = ''; field.uncertain = true; }); record.status = 'review';
    touch(record, `Chọn bản quét để xem trong phiên: ${file.name}. Trường dữ liệu chuyển sang nhập và kiểm tra thủ công.`); renderCase(); setTab('review'); notify('Đã mở bản quét tại máy. Không gửi tệp ra ngoài và không chạy OCR thật.');
  });
  $('archive-case').addEventListener('click', () => performRouteAction('archive'));
  $('reopen-case').addEventListener('click', () => {
    const record = currentRecord(); if (profile.kind !== 'clerk' || workflow(record) !== 'archived') return;
    record.revisions = record.revisions || [];
    record.revisions.push({ at: new Date().toISOString(), documents: JSON.parse(JSON.stringify(record.documents)) });
    record.status = 'review'; record.workflow = 'draft'; record.documents.forEach((doc) => { doc.reviewed = false; });
    touch(record, 'Mở lượt bổ sung hồ sơ mẫu; lưu lại dữ liệu mô tả của lượt trước để đối chiếu.'); renderCase(); setTab('routing');
  });


  // Independent catalogue box shares exactly the same detailed data as the creation form.
  options($('category-department'), departments.map((item) => [item.id, item.name]));
  $('open-categories').addEventListener('click', () => { renderCategories(); showDialog('category-dialog'); });
  $('category-department').addEventListener('change', renderCategories);
  $('category-list').addEventListener('click', (event) => { const button = event.target.closest('[data-create-category]'); if (!button) return; $('category-dialog').close(); openNew(button.dataset.createCategory); });

  $('export-cases').addEventListener('click', () => {
    const values = [['Mã hồ sơ', 'Tên hồ sơ', 'Cơ quan', 'Phòng/ban', 'Nhóm công việc', 'Năm', 'Số giấy tờ', 'Trạng thái', 'Vị trí bản giấy', 'Cập nhật'], ...filteredRecords().map((record) => { const category = categoryByCode.get(record.categoryCode); return [record.code, record.title, category.group, category.departmentName, category.title, record.year, record.documents.length, flowNames[workflow(record)], record.location, date(record.updatedAt, true)]; })];
    const cell = (value) => { let text = String(value); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    const url = URL.createObjectURL(new Blob(['\ufeff' + values.map((row) => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'danh-sach-ho-so-thi-diem.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify(`Đã xuất ${values.length - 1} hồ sơ theo bộ lọc hiện tại.`);
  });
  $('reset-demo').addEventListener('click', () => showDialog('reset-dialog'));
  $('confirm-reset').addEventListener('click', () => {
    if (profile.kind !== 'clerk') return;
    for (const file of sessionFiles.values()) URL.revokeObjectURL(file.url); sessionFiles.clear();
    const imported = records.filter(record => record.documents.some(doc => !doc.sample));
    records = [...imported, ...seedRecords()]; save(); clearFilters(); $('reset-dialog').close(); notify('Đã khôi phục bộ mẫu; giữ các hồ sơ có giấy tờ thật.');
  });
  $('switch-role').addEventListener('click', openRolePicker);
  $('role-form').addEventListener('change', (event) => { if (event.target.name === 'role') updateRolePicker(); });
  $('role-form').addEventListener('submit', (event) => {
    event.preventDefault();
    profile = { kind: $('role-form').elements.role.value, department: ['employee', 'manager'].includes($('role-form').elements.role.value) ? $('role-department').value : '', user: $('role-person').value };
    roleChosen = true;
    try { sessionStorage.setItem('hoso-pilot-role', JSON.stringify(profile)); } catch { /* Session-only mode still works. */ }
    $('role-dialog').close(); applyRole();
  });
  $('close-role-picker').addEventListener('click', () => { if (roleChosen) $('role-dialog').close(); });
  $('role-dialog').addEventListener('cancel', (event) => { if (!roleChosen) event.preventDefault(); });
  $('role-dashboard').addEventListener('click', (event) => {
    const item = event.target.closest('[data-open-route]'); if (item) { openCase(item.dataset.openRoute, 'routing'); return; }
    const topic = event.target.closest('[data-topic]'); if (topic) { clearFilters(); topicFilter = topic.dataset.topic; renderList(); $('list-title').scrollIntoView({ block: 'start' }); }
  });
  $('decision-form').addEventListener('submit', (event) => event.preventDefault());
  $('decision-actions').addEventListener('click', (event) => { const button = event.target.closest('[data-route-action]'); if (button && !button.disabled) performRouteAction(button.dataset.routeAction); });
  $('assignment-form').addEventListener('submit', (event) => {
    event.preventDefault(); const record = currentRecord(); if (!canAssign(record)) return;
    record.assignee = $('assignment-person').value; record.dueDate = $('assignment-due').value; record.workflow = 'draft';
    touch(record, `Phân công ${record.assignee}; hạn hoàn thành nội bộ ${record.dueDate}.`); renderCase(); setTab('routing'); notify('Đã lưu phân công trong bản thí điểm.');
  });
  $('edit-group').addEventListener('change', () => fillEditDepartments());
  $('edit-department').addEventListener('change', () => fillEditCategories());
  $('edit-category').addEventListener('change', updateComposition);
  $('case-type-list').addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-type]'); const record = currentRecord();
    if (!button || classificationDirty || !canEdit(record)) return;
    $('document-type').value = button.dataset.addType; setTab('documents'); $('add-document-form').hidden = false; $('document-type').focus();
  });
  if (!roleChosen && new URLSearchParams(location.search).get('group') === 'HDND') profile = { kind: 'council', department: '', user: 'cv-01' };
  applyRole();
  if (!roleChosen) openRolePicker();
  if (storageWorks) save();
  if (location.protocol !== 'file:') {
    window.ScanBridge.sync().then(imported => {
      if (!imported.every(validRecord)) { notify('Một hồ sơ nhập chưa đúng cấu trúc. Dữ liệu trên máy vẫn được giữ.'); return; }
      records = imported; renderList();
      const requested = new URLSearchParams(location.search).get('case');
      if (requested && roleChosen) {
        const target = records.find(record => record.id === requested);
        if (target && inScope(target)) openCase(requested, 'review');
        else notify('Hồ sơ nằm ngoài phạm vi vai trò đang chọn.');
      }
    }).catch(() => { /* Existing prototype remains usable without the local service. */ });
  }
})();
