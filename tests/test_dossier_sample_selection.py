"""The inbox must select the verified full batch exactly once."""
import json

from sam3_service import documents


def test_inbox_uses_full_batch_only_after_verification(tmp_path, monkeypatch):
    monkeypatch.setattr(documents, 'ROOT', tmp_path)
    monkeypatch.setattr(documents, 'DATA', tmp_path/'data/sam3')
    original = tmp_path/'data/tuliem-dossiers'
    full = tmp_path/'data/tuliem-dossiers-full'
    original.mkdir(parents=True); full.mkdir(parents=True)
    (original/'manifest.json').write_text(json.dumps({'documents': [{'id': 'old'}]}))
    (full/'manifest.json').write_text(json.dumps({'documents': [{'id': 'full'}]}))
    assert documents.sample_records() == [{'id': 'old'}]
    (full/'verification.json').write_text(json.dumps({'passed': False}))
    assert documents.sample_records() == [{'id': 'old'}]
    (full/'verification.json').write_text(json.dumps({'passed': True}))
    assert documents.sample_records() == [{'id': 'full'}]
