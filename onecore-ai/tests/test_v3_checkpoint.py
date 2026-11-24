import copy
import hashlib
import json
import random

import numpy as np
import pytest
import torch
from PIL import Image
from tokenizers import Tokenizer, models, pre_tokenizers

from onecore.v3 import V3Config, V3_CHECKPOINT_FORMAT_VERSION
from onecore.v3.checkpoint import (
    fingerprint_validated_v3_manifests, load_v3_checkpoint,
    save_v3_checkpoint, sha256_bytes,
)


def test_v3_checkpoint_format_version_is_public_and_isolated():
    assert V3_CHECKPOINT_FORMAT_VERSION == 1


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
        lineage={"run_id": "run-v3-001", "session": (2 if parent is not None else 1),
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


def _validated_manifest_fixture(tmp_path):
    paths = {}
    for split_index, split in enumerate(("train", "validation", "test")):
        rows = []
        asset_dir = tmp_path / split
        asset_dir.mkdir(parents=True)
        image_path = asset_dir / "image.png"
        frame_a = asset_dir / "frame-a.png"
        frame_b = asset_dir / "frame-b.png"
        Image.new("RGB", (16, 16), (10 + split_index, 20, 30)).save(image_path)
        Image.new("RGB", (16, 16), (40, 50 + split_index, 60)).save(frame_a)
        Image.new("RGB", (16, 16), (70, 80, 90 + split_index)).save(frame_b)
        audio_path = asset_dir / "audio.wav"
        audio_path.write_bytes(f"external-audio-{split}".encode())
        audio_training_path = asset_dir / "audio-training.wav"
        audio_training_path.write_bytes(f"external-audio-training-{split}".encode())

        def provenance(source, row):
            return {
                "source_url": "https://example.org/external-dataset",
                "data_class": "external",
                "source_id": source,
                "source_revision": "c" * 40,
                "source_row_id_sha256": hashlib.sha256(row.encode()).hexdigest(),
            }

        rows.extend([
            {
                **provenance(f"{split}-text", f"{split}-text-row"),
                "id": f"{split}-text", "split": split, "task": "text",
                "text": "A sufficiently long external text row for the manifest gate.",
            },
            {
                **provenance(f"{split}-tool", f"{split}-tool-row"),
                "id": f"{split}-tool", "split": split, "task": "tool_use",
                "prompt": "Search for the requested source record.",
                "response": '{"name":"search","arguments":{"query":"onecore"}}',
            },
            {
                **provenance(f"{split}-image", f"{split}-image-row"),
                "id": f"{split}-image", "split": split, "task": "image_caption",
                "caption": "An externally sourced image.", "assets": {
                    "image": {"source_asset": f"{split}/image.png"},
                },
            },
            {
                **provenance(f"{split}-audio", f"{split}-audio-row"),
                "id": f"{split}-audio", "split": split, "task": "audio_text",
                "transcript": "A short external audio transcript.", "assets": {
                    "audio": {
                        "source_asset": f"{split}/audio.wav",
                        "training_asset": f"{split}/audio-training.wav",
                    },
                },
            },
            {
                **provenance(f"{split}-video", f"{split}-video-row"),
                "id": f"{split}-video", "split": split, "task": "video_caption",
                "caption": "A two-frame external video.", "assets": {
                    "video": {"frames": [f"{split}/frame-a.png", f"{split}/frame-b.png"]},
                },
            },
        ])
        path = tmp_path / f"{split}.jsonl"
        path.write_text(
            "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
            encoding="utf-8",
        )
        paths[split] = path
    return paths


def test_checkpoint_manifest_fingerprint_validates_all_five_families_and_asset_bytes(tmp_path):
    paths = _validated_manifest_fixture(tmp_path)
    first = fingerprint_validated_v3_manifests(
        paths, tmp_path, minimum_train=1, minimum_holdout=1
    )
    assert first["validation"]["passed"]
    assert first["validation"]["accepted_external_records"] == 15
    assert set(first["validation"]["coverage"]["train"]) == {
        "text", "tool", "image", "audio", "video",
    }
    assert len(first["manifest_sha256"]) == 64

    (tmp_path / "train" / "image.png").write_bytes(b"changed-external-asset")
    second = fingerprint_validated_v3_manifests(
        paths, tmp_path, minimum_train=1, minimum_holdout=1
    )
    assert second["manifest_sha256"] != first["manifest_sha256"]


def test_checkpoint_manifest_fingerprint_rejects_records_in_wrong_split(tmp_path):
    paths = _validated_manifest_fixture(tmp_path)
    validation = json.loads(paths["validation"].read_text(encoding="utf-8").splitlines()[0])
    validation["split"] = "train"
    paths["validation"].write_text(
        json.dumps(validation) + "\n", encoding="utf-8"
    )
    with pytest.raises(ValueError, match="assigned to another split"):
        fingerprint_validated_v3_manifests(
            paths, tmp_path, minimum_train=1, minimum_holdout=1
        )


def test_v3_checkpoint_save_rejects_model_with_config_mismatch(tmp_path):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    changed = V3Config(**{**config.to_dict(), "dropout": 0.1})
    with pytest.raises(ValueError, match="model/config mismatch.*dropout"):
        save_v3_checkpoint(
            tmp_path / "mismatch.pt", model, optimizer, scheduler, 7, changed,
            tokenizer_json=_tokenizer_json(config.text_vocab_size),
            manifest_sha256="a" * 64,
            data_state={},
            lineage={"run_id": "run-v3-001", "session": 1,
                     "parent_checkpoint_sha256": None},
        )


def test_v3_checkpoint_rejects_bad_optimizer_tensor_before_mutating_model(tmp_path):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    path = tmp_path / "corrupt-optimizer.pt"
    _, _, manifest_sha = _save(path, model, optimizer, scheduler, config)
    payload = torch.load(path, map_location="cpu", weights_only=False)
    saved_group = payload["optimizer_state_dict"]["param_groups"][0]
    saved_parameter_id = saved_group["params"][0]
    payload["optimizer_state_dict"]["state"][saved_parameter_id]["exp_avg"] = torch.zeros(1)
    torch.save(payload, path)

    with torch.no_grad():
        for parameter in model.parameters():
            parameter.add_(0.125)
    expected_model = copy.deepcopy(model.state_dict())
    expected_optimizer = copy.deepcopy(optimizer.state_dict())
    expected_scheduler = copy.deepcopy(scheduler.state_dict())

    with pytest.raises(ValueError, match="optimizer tensor shape mismatch"):
        load_v3_checkpoint(
            path, model, optimizer, scheduler, config,
            expected_manifest_sha256=manifest_sha,
            expected_parent_checkpoint_sha256=None,
        )

    _assert_nested_equal(model.state_dict(), expected_model)
    _assert_nested_equal(optimizer.state_dict(), expected_optimizer)
    _assert_nested_equal(scheduler.state_dict(), expected_scheduler)


def test_v3_checkpoint_save_rejects_scheduler_attached_to_another_optimizer(tmp_path):
    config = _config()
    model = config.build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    wrong_optimizer = torch.optim.AdamW(model.parameters(), lr=2e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(wrong_optimizer, step_size=1)
    with pytest.raises(ValueError, match="exact optimizer"):
        save_v3_checkpoint(
            tmp_path / "wrong-scheduler.pt", model, optimizer, scheduler, 0, config,
            tokenizer_json=_tokenizer_json(config.text_vocab_size),
            manifest_sha256="a" * 64,
            data_state={},
            lineage={"run_id": "run-v3-001", "session": 1,
                     "parent_checkpoint_sha256": None},
        )

def test_v3_checkpoint_rejects_optimizer_not_bound_to_model_on_save(tmp_path):
    config = _config()
    model = config.build_model()
    foreign_model = config.build_model()
    optimizer = torch.optim.AdamW(foreign_model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.8)

    with pytest.raises(ValueError, match="exactly the model's trainable parameters"):
        save_v3_checkpoint(
            tmp_path / "foreign-optimizer.pt", model, optimizer, scheduler, 0, config,
            tokenizer_json=_tokenizer_json(config.text_vocab_size),
            manifest_sha256="a" * 64,
            data_state={"source_cursors": {"text/train": {"offset": 0}}},
            lineage={"run_id": "run-v3-foreign", "session": 1,
                     "parent_checkpoint_sha256": None},
        )


def test_v3_checkpoint_rejects_foreign_optimizer_before_restoring_model(tmp_path):
    config = _config()
    model, optimizer, scheduler = _make_training_state(config)
    checkpoint_path = tmp_path / "onecore-v3.pt"
    _, _, manifest_sha = _save(checkpoint_path, model, optimizer, scheduler, config)

    foreign_model = config.build_model()
    foreign_optimizer = torch.optim.AdamW(foreign_model.parameters(), lr=1e-3)
    foreign_scheduler = torch.optim.lr_scheduler.StepLR(
        foreign_optimizer, step_size=1, gamma=0.8
    )
    with torch.no_grad():
        for parameter in model.parameters():
            parameter.add_(0.125)
    expected_model = copy.deepcopy(model.state_dict())

    with pytest.raises(ValueError, match="exactly the model's trainable parameters"):
        load_v3_checkpoint(
            checkpoint_path, model, foreign_optimizer, foreign_scheduler, config,
            expected_manifest_sha256=manifest_sha,
            expected_parent_checkpoint_sha256=None,
        )

    _assert_nested_equal(model.state_dict(), expected_model)

