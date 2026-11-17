"""Giữ nguồn đã xác minh và tokenizer gốc khi chuyển checkpoint tùy chọn."""
import hashlib
import json
import sys
from types import SimpleNamespace

import pytest


@pytest.fixture
def source(tmp_path, monkeypatch):
    from document_ai import convert_qwen as converter

    root = tmp_path / "models"
    original = root / "source"
    original.mkdir(parents=True)
    weights = b"verified source weights"
    (original / "model.safetensors").write_bytes(weights)
    (original / "tokenizer.json").write_text("original tokenizer")
    (original / "chat_template.jinja").write_text("original template")
    meta = {"model.safetensors": {"sha256": hashlib.sha256(weights).hexdigest(), "bytes": len(weights)}}
    (tmp_path / "download-receipt.json").write_text(json.dumps({"models": {
        "source_key": {"revision": "pinned", "weights": meta}}}))
    monkeypatch.setattr(converter, "AI_HOME", tmp_path)
    monkeypatch.setattr(converter, "MODEL_ROOT", root)
    monkeypatch.setattr(converter, "TARGETS", {"test": ("source_key", "converted")})
    monkeypatch.setattr(converter, "OPTIONAL_MODELS", {"source_key": ("author/model", "pinned", "source", "model.safetensors")})
    monkeypatch.setattr(converter.importlib.metadata, "version", lambda _: "test-version")
    for key in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "TOKENIZERS_PARALLELISM"):
        monkeypatch.setenv(key, "test")
    return converter, original, root / "converted"


def test_conversion_preserves_template_and_records_exact_weights(source, monkeypatch):
    converter, original, target = source
    from pathlib import Path

    def convert(src, dest, **kwargs):
        assert Path(src) == original
        assert kwargs == {"quantize": True, "q_bits": 4, "q_group_size": 64,
                          "q_mode": "affine", "trust_remote_code": False}
        stage = Path(dest)
        stage.mkdir()
        (stage / "model.safetensors").write_bytes(b"converted")
        (stage / "tokenizer.json").write_text("rewritten by converter")

    monkeypatch.setitem(sys.modules, "mlx_lm.convert", SimpleNamespace(convert=convert))
    converter.convert_checkpoint("test")
    assert (target / "tokenizer.json").read_bytes() == (original / "tokenizer.json").read_bytes()
    assert (target / "chat_template.jinja").read_bytes() == (original / "chat_template.jinja").read_bytes()
    receipt = json.loads((target / "conversion-receipt.json").read_text())
    assert receipt["repo"] == "author/model" and receipt["revision"] == "pinned"
    assert receipt["weights"]["model.safetensors"]["sha256"] == hashlib.sha256(b"converted").hexdigest()
    assert not target.with_name("converted.converting").exists()
    with pytest.raises(SystemExit, match="Không ghi đè"):
        converter.convert_checkpoint("test")


def test_conversion_refuses_modified_source_before_loading_model(source):
    converter, original, target = source
    (original / "model.safetensors").write_bytes(b"tampered")
    with pytest.raises(SystemExit, match="bị thay đổi"):
        converter.convert_checkpoint("test")
    assert not target.exists()
