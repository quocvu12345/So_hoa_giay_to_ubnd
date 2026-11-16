#!/usr/bin/env python3
"""Rebuild the smoke-test report from completed local jobs, without running AI."""
import json
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/citizen-samples'


def normalized(value):
    return ' '.join(unicodedata.normalize('NFC', value).casefold().split())


def main():
    report = json.loads((DATA / 'benchmark.json').read_text())
    truth = json.loads((DATA / 'ground-truth.json').read_text())
    manifest = {r['id']: r for r in json.loads((DATA / 'manifest.json').read_text())['documents']}
    lines = ['# Kết quả thử local trên bộ mẫu công dân', '',
             'Đây là smoke test trên mẫu công khai và font mô phỏng, không đo độ chính xác chữ viết tay thật.', '',
             '| PDF | Trang | Thời gian xử lý ban đầu | Loại gợi ý | Khớp loại mẫu | Trường đối chiếu chính xác |',
             '|---|---:|---:|---|---|---|']
    failures = []
    for entry in report['results']:
        id = entry['document_id']
        result = json.loads((ROOT / 'data/sam3/runtime/extractions' / entry['job_id'] / 'result.json').read_text())
        suggestion = result.get('suggestion') or {}
        fields = {f['label']: f['value'] for f in suggestion.get('fields', [])}
        expected = truth.get(id, {}).get('expected_fields', {})
        checks = {label: normalized(value) == normalized(fields.get(label, '')) for label, value in expected.items()}
        entry.update(fields=fields, exact_field_checks=checks,
                     expected_type_id=manifest[id].get('expected_type_id'),
                     type_matches=manifest[id].get('expected_type_id') == suggestion.get('type_id'),
                     postprocessing=result.get('postprocessing'))
        count = f'{sum(checks.values())}/{len(checks)}' if checks else 'Chưa có đáp án từng trường'
        lines.append(f"| {id} | {entry['page_count']} | {entry['elapsed_seconds']} s | {entry['type_id']} | {'Có' if entry['type_matches'] else 'Không'} | {count} |")
        for label, matched in checks.items():
            if not matched:
                failures.append(f"- `{id}` · **{label}**: mong đợi `{expected[label]}`, kết quả `{fields.get(label, '') or '(trống)'}`.")
    lines.extend(['', 'Các trường còn sai hoặc thiếu trong phần đã đối chiếu:', '', *failures, '',
                  'Mẫu nhân thân để trống mục vợ/chồng; không suy ra quan hệ hôn nhân từ việc hai người có chung con. Danh sách con là nhiều giá trị, cần đối chiếu thủ công.', '',
                  'Các trường chưa nằm trong đáp án vẫn có thể sai. “Đã đọc mọi trang” chỉ có nghĩa pipeline đã xử lý từng trang, không bảo đảm đọc đủ từng chữ. Một số địa chỉ, đơn vị diện tích và trường nhiều người còn cần sửa.', '',
                  'Dòng ngày/tháng/năm để trống trong hợp đồng đã bị bộ lọc loại bỏ; bản trước khi lọc được giữ trong thư mục job. Thời gian bảng là lần xử lý ban đầu, không giả định chạy lại model.', '',
                  'Kết quả chi tiết: `benchmark.json`; đáp án giả lập: `ground-truth.json`. Không nhập các đáp án này làm dữ liệu OCR hoặc dữ liệu đã xác minh.'])
    (DATA / 'benchmark.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (DATA / 'benchmark.md').write_text('\n'.join(lines) + '\n')
    print(f"Rebuilt report for {len(report['results'])} actual local jobs.")


if __name__ == '__main__':
    main()
