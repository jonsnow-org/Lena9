import copy
import hashlib
import json

import numpy as np
import pytest
import soundfile as sf
from PIL import Image
from tokenizers import Tokenizer, decoders, models, normalizers, pre_tokenizers

from onecore.v3.checkpoint import _normalise_data_state
from onecore.v3.config import V3Config
from onecore.v3.dataset import FAMILIES, V3JointDataLoader
from onecore.v3.tokenizer import SPECIAL_TOKENS


def _write_project(root):
    assets_root = root / "assets"
    assets_root.mkdir(parents=True)
    manifest_paths = {}
    for split_index, split in enumerate(("train", "validation", "test")):
        quota = 100 if split == "train" else 10
        rows = []
        for family in FAMILIES:
            for index in range(quota):
                record_id = f"{split}-{family}-{index}"
                source_index = index % 2
                source_id = f"{family}-source-{source_index}"
                revision = "a" * 40 if source_index == 0 else "b" * 40
                common = {
                    "id": record_id,
                    "split": split,
                    "source_url": f"https://example.org/{source_id}",
                    "source_id": source_id,
                    "source_revision": revision,
                    "source_row_id_sha256": hashlib.sha256(
                        f"{split}/{family}/{index}".encode()
                    ).hexdigest(),
                    "data_class": "external",
                }
                if family == "text":
                    row = {
                        **common, "task": "text",
                        "text": f"External text sample {index} from {split}; tokenizer training record.",
                    }
                elif family == "tool":
                    row = {
                        **common, "task": "tool_use",
                        "prompt": f"Search for item {index} in {split}.",
                        "response": {"tool": "search", "arguments": {"query": f"item-{index}-{split}"}},
                    }
                elif family == "image":
                    relative = f"raw/images/{record_id}.png"
                    path = assets_root / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    pixels = np.zeros((2, 2, 3), dtype=np.uint8)
                    pixels[0, 0] = (split_index, index, 17)
                    pixels[0, 1] = (index, split_index, 29)
                    Image.fromarray(pixels).save(path)
                    row = {
                        **common, "task": "image_caption",
                        "assets": {"image": {"source_asset": relative, "width": 2, "height": 2}},
                    }
                elif family == "audio":
                    relative = f"raw/audio/{record_id}.wav"
                    path = assets_root / relative
                    path.parent.mkdir(parents=True, exist_ok=True)
                    channels = 1 if index % 2 == 0 else 2
                    signal = np.linspace(-0.45, 0.45, 64, dtype=np.float32)
                    signal += np.float32((split_index * 100 + index) / 10000)
                    samples = signal[:, None] if channels == 1 else np.stack((signal, -signal), axis=1)
                    sf.write(path, samples, 24_000, subtype="PCM_24")
                    row = {
                        **common, "task": "audio_text",
                        "assets": {"audio": {
                            "source_asset": relative, "training_asset": relative,
                            "sample_rate": 24_000, "training_sample_rate": 24_000,
                            "channels": channels, "training_channels": channels,
                            "training_samples": 64,
                        }},
                    }
                else:
                    frame_paths = []
                    for frame_index in range(3):
                        relative = f"frames/{record_id}/{frame_index:08d}.png"
                        path = assets_root / relative
                        path.parent.mkdir(parents=True, exist_ok=True)
                        pixels = np.zeros((2, 2, 3), dtype=np.uint8)
                        pixels[0, 0] = (split_index, index, frame_index)
                        pixels[0, 1] = (frame_index + 1, index, split_index)
                        Image.fromarray(pixels).save(path)
                        frame_paths.append(relative)
                    row = {
                        **common, "task": "video_caption",
                        "assets": {"video": {
                            "frames": frame_paths, "timestamps": [0.0, 0.04, 0.08],
                            "timestamp_unit": "seconds", "frame_count": 3, "width": 2, "height": 2,
                        }},
                    }
                rows.append(row)
        manifest = root / f"{split}.jsonl"
        manifest.write_text(
            "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
            encoding="utf-8",
        )
        manifest_paths[split] = manifest
    return manifest_paths, assets_root


def _write_exact_v3_test_tokenizer(train_manifest, path, config):
    vocab = {}
    for token in SPECIAL_TOKENS:
        vocab[token] = len(vocab)
    for token in sorted(pre_tokenizers.ByteLevel.alphabet()):
        if token not in vocab:
            vocab[token] = len(vocab)
    while len(vocab) < config.text_vocab_size:
        token = f"<unused_{len(vocab):05d}>"
        if token not in vocab:
            vocab[token] = len(vocab)
    tokenizer = Tokenizer(models.BPE(vocab=vocab, merges=[], unk_token="[UNK]"))
    tokenizer.normalizer = normalizers.NFC()
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    tokenizer_json = tokenizer.to_str(pretty=False).encode("utf-8")
    path.write_bytes(tokenizer_json)
    evidence = {
        "format_version": 1,
        "architecture_family": "onecore-v3",
        "architecture_version": config.architecture_version,
        "config_sha256": config.fingerprint,
        "tokenizer_algorithm": "byte-level BPE",
        "unicode_normalization": "NFC",
        "vocab_size_requested": config.text_vocab_size,
        "vocab_size_actual": tokenizer.get_vocab_size(with_added_tokens=True),
        "special_tokens": list(SPECIAL_TOKENS),
        "special_token_ids": {token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS},
        "training_split": "train",
        "training_family": "text",
        "data_class": "external",
        "external_train_text_records": 100,
        "train_manifest_sha256": hashlib.sha256(train_manifest.read_bytes()).hexdigest(),
        "external_text_rows_sha256": hashlib.sha256(b"external train text rows").hexdigest(),
        "minimum_text_records_required": 100,
        "tokenizer_sha256": hashlib.sha256(tokenizer_json).hexdigest(),
        "tokenizer_file": path.name,
        "validation_or_test_rows_used": 0,
        "v2_tokenizer_imported": False,
    }
    path.with_name(path.name + ".evidence.json").write_text(
        json.dumps(evidence, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def _build_loader(root):
    manifests, assets_root = _write_project(root / "project")
    config = V3Config()
    tokenizer_path = root / "v3-tokenizer.json"
    _write_exact_v3_test_tokenizer(manifests["train"], tokenizer_path, config)
    loader = V3JointDataLoader(
        manifests, assets_root, tokenizer_path, config=config,
        max_text_tokens=16, audio_window_seconds=0.001, video_window_frames=2,
    )
    return loader, assets_root


def test_v3_joint_loader_emits_five_families_and_resumes_exact_source_cursors(tmp_path):
    loader, _assets_root = _build_loader(tmp_path)
    with loader:
        first = loader.next_joint_micro_batches()
        assert tuple(item.family for item in first) == FAMILIES
        assert all(set(item.batch) == {item.family} for item in first)
        assert first[0].batch["text"]["input_ids"].shape[1] <= 16
        assert first[1].batch["tool"]["input_ids"].shape[1] <= 16
        assert first[2].batch["image"]["images"].shape == (1, 3, 2, 2)
        assert first[3].batch["audio"]["waveform"].shape[-1] == 24
        assert first[3].batch["audio"]["sample_rate"] == 24_000
        assert first[4].batch["video"]["frames"].shape == (1, 2, 3, 2, 2)
        start = first[4].metadata["window_start_frame"]
        assert first[4].batch["video"]["timestamps"].tolist() == [
            [start * 0.04, (start + 1) * 0.04]
        ]
        saved_state = loader.state_dict()
        assert loader.current_step == 1
        assert all(saved_state["families"][family]["rows_consumed"] == 1 for family in FAMILIES)
        _normalise_data_state(saved_state, manifest_sha256=loader.manifest_sha256, global_step=1)
        expected_next = loader.next_joint_micro_batches()
        expected_ids = [item.record_id for item in expected_next]
        expected_state = loader.state_dict()

    resumed, _assets_again = _build_loader(tmp_path / "resume")
    with resumed:
        resumed.load_state_dict(saved_state)
        actual_next = resumed.next_joint_micro_batches()
        assert [item.record_id for item in actual_next] == expected_ids
        assert resumed.state_dict() == expected_state


def test_v3_joint_loader_rejects_cursor_anchor_mismatch_without_partial_restore(tmp_path):
    loader, _assets_root = _build_loader(tmp_path)
    with loader:
        loader.next_joint_micro_batches()
        state = loader.state_dict()
    resumed, _assets_again = _build_loader(tmp_path / "resume")
    with resumed:
        initial = resumed.state_dict()
        bad = copy.deepcopy(state)
        consumed = next(key for key, value in bad["source_cursors"].items() if value["rows_consumed"] > 0)
        bad["source_cursors"][consumed]["last_source_row_id_sha256"] = "f" * 64
        with pytest.raises(ValueError, match="row anchor mismatch"):
            resumed.load_state_dict(bad)
        assert resumed.state_dict() == initial
        bad_manifest = copy.deepcopy(state)
        bad_manifest["manifest_sha256"] = "0" * 64
        with pytest.raises(ValueError, match="manifest_sha256 mismatch"):
            resumed.load_state_dict(bad_manifest)
        assert resumed.state_dict() == initial


def test_v3_joint_loader_materialization_failure_does_not_advance_any_family(tmp_path):
    loader, assets_root = _build_loader(tmp_path)
    with loader:
        image_path = assets_root / "raw" / "images" / "train-image-0.png"
        image_path.write_bytes(image_path.read_bytes() + b"tampered")
        with pytest.raises(ValueError, match="SHA-256 changed"):
            loader.next_joint_micro_batches()
        assert loader.current_step == 0
        assert all(
            loader.state_dict()["families"][family]["rows_consumed"] == 0
            for family in FAMILIES
        )
