/* Shared import bridge. PDF originals and filing receipts live in the local service. */
(() => {
  const key = 'ubnd-hdnd-pilot-v1';
  function read() {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (data.version !== 1 || !Array.isArray(data.records)) throw new Error('Không đọc được kho hồ sơ trên trình duyệt. Dữ liệu hiện có được giữ nguyên.');
    return data.records;
  }
  function merge(records, placements) {
    for (const placement of placements) {
      let record = records.find(item => item.id === placement.case.id);
      if (!record) { record = structuredClone(placement.case); records.unshift(record); }
      if (!record.documents.some(doc => doc.sourceDocumentId === placement.document_id)) {
        record.documents.push(structuredClone(placement.document));
        record.updatedAt = placement.filed_at;
        record.history.push({ at: placement.filed_at, text: `Tiếp nhận PDF: ${placement.document.name}. ${placement.document.extractionJobId ? 'Có kết quả đọc trên máy local để đối chiếu.' : 'Thông tin được nhập theo bản gốc.'}` });
      }
    }
    return records;
  }
  async function sync() {
    const response = await fetch('/api/inbox/placements');
    if (!response.ok) throw new Error('Chưa kết nối được dịch vụ hồ sơ local.');
    const { placements } = await response.json();
    const update = () => {
      const records = merge(read(), placements);
      if (placements.length) localStorage.setItem(key, JSON.stringify({ version: 1, records }));
      return records;
    };
    return navigator.locks ? navigator.locks.request(key, update) : update();
  }
  window.ScanBridge = { read, merge, sync };
})();
