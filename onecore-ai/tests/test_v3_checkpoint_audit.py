import hashlib

import numpy as np
import pytest
import torch
from tokenizers import Tokenizer, models, pre_tokenizers

from onecore.v3.checkpoint_audit import audit_checkpoint_round_trip
from onecore.v3.config import V3Config


def _config():
    return V3Config(
        text_vocab_size=64,
        width=32,
        layers=1,
        cycles=2,
        attention_heads=4,
        patch_size=4,
        audio_latent_channels=8,
        audio_hidden_channels=16,
        audio_codebook_size=16,
        audio_quantizer_stages=2,
        audio_channels=1,
        temporal_layers=1,
        max_image_context_tokens=8,
        max_video_context_tokens=8,
        max_flow_context_tokens=8,
        temporal_window_frames=4,
        temporal_memory_frames=1,
        video_generation_chunk_frames=2,
        dropout=0.0,
    )


def _tokenizer_json(vocab_size=64):
    vocab = {"[UNK]": 0, "[BOS]": 1, "[EOS]": 2, "[PAD]": 3}
    vocab.update({f"piece_{index}": index for index in range(4, vocab_size)})
    tokenizer = Tokenizer(models.BPE(vocab=vocab, merges=[], unk_token="[UNK]"))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer.add_special_tokens(["[UNK]", "[BOS]", "[EOS]", "[PAD]"])
    return tokenizer.to_str().encode("utf-8")


def _data_state(manifest_sha):
    families = {}
    source_cursors = {}
    for family in ("text", "tool", "image", "audio", "video"):
        source_id = f"fixture-{family}"
        revision = "c" * 40
        families[family] = {"rows_consumed": 0, "last_record_id": None}
        source_cursors[f"{family}::{source_id}@{revision}"] = {
            "family": family,
            "source_id": source_id,
            "source_revision": revision,
            "source_url": f"https://example.org/{source_id}",
            "data_class": "external",
            "split": "train",
            "rows_consumed": 0,
            "cursor_state": {"mode": "offset", "offset": 0},
            "last_source_row_id_sha256": None,
        }
    return {
        "format_version": 1,
        "manifest_sha256": manifest_sha,
        "split": "train",
        "families": families,
        "source_cursors": source_cursors,
    }


def test_v3_artifact_checkpoint_round_trip_preserves_all_state_without_updates(tmp_path):
    config = _config()
    manifest_sha = "a" * 64
    result = audit_checkpoint_round_trip(
        config=config,
        tokenizer_json=_tokenizer_json(config.text_vocab_size),
        manifest_sha256=manifest_sha,
        data_state=_data_state(manifest_sha),
        output_directory=tmp_path,
        run_id="checkpoint-audit-test",
    )

    assert result["status"] == "passed"
    assert result["global_step"] == 0
    assert result["optimizer_updates"] == 0
    assert result["optimizer_state_entries"] == 0
    assert result["python_numpy_torch_rng_restored"] is True
    assert result["model_optimizer_scheduler_restored"] is True
    assert set(result["family_cursors"]) == {"text", "tool", "image", "audio", "video"}
    assert result["checkpoint_file_retained"] is False
    assert not (tmp_path / "checkpoint-audit-step-000000.pt").exists()


def test_v3_checkpoint_audit_rejects_manifest_state_mismatch(tmp_path):
    config = _config()
    state = _data_state("b" * 64)
    with pytest.raises(ValueError, match="manifest"):
        audit_checkpoint_round_trip(
            config=config,
            tokenizer_json=_tokenizer_json(config.text_vocab_size),
            manifest_sha256="a" * 64,
            data_state=state,
            output_directory=tmp_path,
            run_id="bad-manifest-test",
        )


def test_v3_checkpoint_audit_requires_real_tokenizer_bytes(tmp_path):
    config = _config()
    with pytest.raises(Exception):
        audit_checkpoint_round_trip(
            config=config,
            tokenizer_json=b"not a tokenizer",
            manifest_sha256="a" * 64,
            data_state=_data_state("a" * 64),
            output_directory=tmp_path,
            run_id="bad-tokenizer-test",
        )
