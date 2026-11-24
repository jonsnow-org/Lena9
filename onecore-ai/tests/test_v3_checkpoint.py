import copy
import random

import numpy as np
import pytest
import torch
from tokenizers import Tokenizer, models, pre_tokenizers

from onecore.v3 import V3Config
from onecore.v3.checkpoint import (
    load_v3_checkpoint, save_v3_checkpoint, sha256_bytes,
)


def _config():
    return V3Config(
        text_vocab_size=64, width=32, layers=1, cycles=2,
        attention_heads=4, patch_size=4,
        audio_latent_channels=8, audio_hidden_channels=16,
        audio_codebook_size=16, audio_quantizer_stages=2,
        audio_channels=1, temporal_layers=1,
        max_image_context_tokens=8, max_video_context_tokens=8,
        max_flow_context_tokens=8, temporal_window_frames=4,
        temporal_memory_frames=1, video_generation_chunk_frames=2,
    )


def _tokenizer_json(vocab_size=64):
    vocab = {"[UNK]": 0}
    vocab.update({f"piece_{index}": index for index in range(1, vocab_size)})
    tokenizer = Tokenizer(models.BPE(vocab=vocab, merges=[], unk_token="[UNK]"))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    return tokenizer.to_str().encode("utf-8")


def _make_training_state(config):
    model = config.build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.8)
    loss = sum(parameter.float().square().mean() for parameter in model.parameters())
    loss.backward()
    optimizer.step()
    scheduler.step()
    return model, optimizer, scheduler


def _assert_nested_equal(left, right):
    if isinstance(left, torch.Tensor):
        assert isinstance(right, torch.Tensor)
        assert torch.equal(left, right)
    elif isinstance(left, np.ndarray):
        assert isinstance(right, np.ndarray)
        assert np.array_equal(left, right)
    elif isinstance(left, dict):
        assert set(left) == set(right)
        for key in left:
            _assert_nested_equal(left[key], right[key])
    elif isinstance(left, (list, tuple)):
        assert type(left) is type(right)
        assert len(left) == len(right)
        for a, b in zip(left, right, strict=True):
            _assert_nested_equal(a, b)
    else:
        assert left == right


def _save(path, model, optimizer, scheduler, config, *, parent=None):
    tokenizer = _tokenizer_json(config.text_vocab_size)
    manifest_sha = "a" * 64
    result = save_v3_checkpoint(
        path, model, optimizer, scheduler, 7, config,
        tokenizer_json=tokenizer,
        manifest_sha256=manifest_sha,
        data_state={
            "families": {"text": {"rows_read": 12}, "image": {"rows_read": 4}},
            "source_cursors": {"fleurs_ar/train": {"offset": 12}},
        },
        lineage={"run_id": "run-v3-001", "session": 2,
                 "parent_checkpoint_sha256": parent},
    )
    return result, tokenizer, manifest_sha


def test_v3_checkpoint_round_trips_full_training_lineage_and_rng(tmp_path):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    parent_sha = "b" * 64
    random.seed(101)
    np.random.seed(102)
    torch.manual_seed(103)

    checkpoint_path = tmp_path / "onecore-v3.pt"
    saved, tokenizer_json, manifest_sha = _save(
        checkpoint_path, model, optimizer, scheduler, config, parent=parent_sha
    )
    expected_model = copy.deepcopy(model.state_dict())
    expected_optimizer = copy.deepcopy(optimizer.state_dict())
    expected_scheduler = copy.deepcopy(scheduler.state_dict())
    expected_random = (random.random(), float(np.random.rand()), float(torch.rand(())))

    with torch.no_grad():
        for parameter in model.parameters():
            parameter.add_(0.25)
    random.seed(201)
    np.random.seed(202)
    torch.manual_seed(203)

    step, payload = load_v3_checkpoint(
        checkpoint_path, model, optimizer, scheduler, config,
        expected_manifest_sha256=manifest_sha,
        expected_parent_checkpoint_sha256=parent_sha,
        expected_tokenizer_sha256=sha256_bytes(tokenizer_json),
    )

    assert step == 7
    _assert_nested_equal(model.state_dict(), expected_model)
    _assert_nested_equal(optimizer.state_dict(), expected_optimizer)
    _assert_nested_equal(scheduler.state_dict(), expected_scheduler)
    assert payload["tokenizer_json"] == tokenizer_json
    assert payload["tokenizer_sha256"] == saved["tokenizer_sha256"]
    assert payload["tokenizer_vocab_size"] == config.text_vocab_size
    assert payload["manifest_sha256"] == manifest_sha
    assert payload["data_state"]["source_cursors"]["fleurs_ar/train"]["offset"] == 12
    assert payload["lineage"]["run_id"] == "run-v3-001"
    assert payload["lineage"]["session"] == 2
    assert payload["lineage"]["parent_checkpoint_sha256"] == parent_sha
    assert (random.random(), float(np.random.rand()), float(torch.rand(()))) == expected_random


@pytest.mark.parametrize(
    ("manifest_sha", "parent_sha", "tokenizer_sha", "expected_message"),
    [
        ("c" * 64, "b" * 64, None, "manifest fingerprint mismatch"),
        ("a" * 64, "c" * 64, None, "parent lineage mismatch"),
        ("a" * 64, "b" * 64, "d" * 64, "expected tokenizer fingerprint"),
    ],
)
def test_v3_checkpoint_rejects_manifest_parent_or_tokenizer_mismatch(
    tmp_path, manifest_sha, parent_sha, tokenizer_sha, expected_message,
):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    checkpoint_path = tmp_path / "onecore-v3.pt"
    _, _, _ = _save(
        checkpoint_path, model, optimizer, scheduler, config, parent="b" * 64
    )
    with pytest.raises(ValueError, match=expected_message):
        load_v3_checkpoint(
            checkpoint_path, model, optimizer, scheduler, config,
            expected_manifest_sha256=manifest_sha,
            expected_parent_checkpoint_sha256=parent_sha,
            expected_tokenizer_sha256=tokenizer_sha,
        )


def test_v3_checkpoint_rejects_config_mismatch(tmp_path):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    checkpoint_path = tmp_path / "onecore-v3.pt"
    _, _, manifest_sha = _save(checkpoint_path, model, optimizer, scheduler, config)
    changed = V3Config(**{**config.to_dict(), "dropout": 0.1})
    with pytest.raises(ValueError, match="configuration does not match"):
        load_v3_checkpoint(
            checkpoint_path, model, optimizer, scheduler, changed,
            expected_manifest_sha256=manifest_sha,
            expected_parent_checkpoint_sha256=None,
        )


def test_v3_checkpoint_rejects_tokenizer_vocab_mismatch_on_save(tmp_path):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    with pytest.raises(ValueError, match="tokenizer vocabulary mismatch"):
        save_v3_checkpoint(
            tmp_path / "invalid.pt", model, optimizer, scheduler, 0, config,
            tokenizer_json=_tokenizer_json(32),
            manifest_sha256="a" * 64,
            data_state={},
            lineage={"run_id": "run-v3-001", "session": 1,
                     "parent_checkpoint_sha256": None},
        )
