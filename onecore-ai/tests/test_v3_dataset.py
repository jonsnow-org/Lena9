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
                        "caption": f"External image caption {index} from {split}.",
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
                        "transcript": f"External audio transcript {index} from {split}.",
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
                        "caption": f"External video caption {index} from {split}.",
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
        "tokenizer_contract_sha256": _tokenizer_contract_sha256(config, {token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS}),
    }
    path.with_name(path.name + ".evidence.json").write_text(
        json.dumps(evidence, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )


def _build_loader(root, config=None):
    manifests, assets_root = _write_project(root / "project")
    config = config or V3Config()
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
        assert first[2].batch["image"]["images"].shape == (1, 3, 64, 64)
        assert first[3].batch["audio"]["waveform"].shape[-1] == 24
        assert first[3].batch["audio"]["sample_rate"] == 24_000
        assert first[4].batch["video"]["frames"].shape == (1, 2, 3, 64, 64)
        expected_conditions = (
            (first[2], "caption", "External image caption 0 from train."),
            (first[3], "transcript", "External audio transcript 0 from train."),
            (first[4], "caption", "External video caption 0 from train."),
        )
        for item, field, expected_text in expected_conditions:
            condition_ids = item.batch[item.family]["condition_ids"]
            assert condition_ids.ndim == 2 and condition_ids.shape[0] == 1
            assert 0 < condition_ids.shape[1] <= 16
            full_condition_ids = loader.tokenizer.encode(expected_text).ids
            start = item.metadata["condition_window_start"]
            assert item.metadata["source_condition_tokens"] == len(full_condition_ids)
            assert condition_ids[0].tolist() == full_condition_ids[start:start + 16]
            assert item.metadata["condition_field"] == field
            assert item.metadata["condition_source"] == "same_external_record"
            assert len(item.metadata["condition_text_sha256"]) == 64
        start = first[4].metadata["window_start_frame"]
        assert first[4].batch["video"]["timestamps"].tolist()[0] == pytest.approx(
            [start * 0.04, (start + 1) * 0.04]
        )
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


def test_v3_joint_loader_benchmark_manifest_view_keeps_full_tokenizer_provenance_non_checkpointable(tmp_path):
    manifests, assets_root = _write_project(tmp_path / "project")
    extra = {
        "id": "train-text-extra",
        "split": "train",
        "task": "text",
        "data_class": "external",
        "source_url": "https://example.org/text-extra",
        "source_id": "text-extra-source",
        "source_revision": "c" * 40,
        "source_row_id_sha256": hashlib.sha256(b"train-text-extra").hexdigest(),
        "text": "An extra external text row included only in the original tokenizer corpus.",
    }
    with manifests["train"].open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(extra, ensure_ascii=False, sort_keys=True) + "\n")
    full_train_sha = hashlib.sha256(manifests["train"].read_bytes()).hexdigest()

    subset_paths = {}
    for split in ("train", "validation", "test"):
        rows = [
            json.loads(line)
            for line in manifests[split].read_text(encoding="utf-8").splitlines()
        ]
        rows = [row for row in rows if row.get("id") != "train-text-extra"]
        path = tmp_path / f"benchmark-{split}.jsonl"
        path.write_text(
            "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
            encoding="utf-8",
        )
        subset_paths[split] = path

    config = V3Config()
    tokenizer_path = tmp_path / "v3-tokenizer.json"
    _write_exact_v3_test_tokenizer(manifests["train"], tokenizer_path, config)

    with pytest.raises(ValueError, match="training manifest"):
        V3JointDataLoader(
            subset_paths, assets_root, tokenizer_path, config=config,
            max_text_tokens=16, audio_window_seconds=0.001, video_window_frames=2,
        )

    loader = V3JointDataLoader(
        subset_paths, assets_root, tokenizer_path, config=config,
        max_text_tokens=16, audio_window_seconds=0.001, video_window_frames=2,
        benchmark_manifest_view=True,
        tokenizer_train_manifest_sha256=full_train_sha,
    )
    with loader:
        assert loader.train_manifest_sha256 != full_train_sha
        assert loader.tokenizer_evidence["train_manifest_sha256"] == full_train_sha
        assert loader.current_step == 0
        loader.next_joint_micro_batches()
        with pytest.raises(RuntimeError, match="benchmark manifest view"):
            loader.state_dict()
        with pytest.raises(RuntimeError, match="benchmark manifest view"):
            loader.load_state_dict({})


def test_v3_loader_benchmark_worker_measures_real_five_family_materialization_without_updates(
    tmp_path, monkeypatch,
):
    from onecore.v3 import resource_benchmark as benchmark

    manifests, assets_root = _write_project(tmp_path / "project")
    config = V3Config()
    tokenizer_path = tmp_path / "v3-tokenizer.json"
    _write_exact_v3_test_tokenizer(manifests["train"], tokenizer_path, config)
    plan = {
        "manifest_paths": {split: str(path) for split, path in manifests.items()},
        "assets_root": str(assets_root),
        "tokenizer_path": str(tokenizer_path),
        "tokenizer_train_manifest_sha256": hashlib.sha256(
            manifests["train"].read_bytes()
        ).hexdigest(),
        "source_manifest_bundle_sha256": "a" * 64,
        "iterations": 3,
        "warmup_iterations": 1,
        "max_text_tokens": 16,
        "audio_window_seconds": 0.001,
        "video_window_frames": 2,
    }
    plan_path = tmp_path / "loader-plan.json"
    plan_path.write_text(json.dumps(plan), encoding="utf-8")

    monkeypatch.setattr(benchmark.torch, "set_num_threads", lambda _value: None)
    monkeypatch.setattr(benchmark.torch, "set_num_interop_threads", lambda _value: None)
    monkeypatch.setattr(benchmark.torch.cuda, "is_available", lambda: False)
    monkeypatch.setattr(benchmark, "_load_current_rss_bytes", lambda: 1024)
    monkeypatch.setattr(benchmark, "_max_rss_bytes", lambda: 2048)

    result = benchmark._loader_worker(plan_path, 1)

    assert result["status"] == "success", result
    assert result["benchmark_kind"].startswith("v3_joint_data_loader")
    assert result["measured_joint_steps"] == 2
    assert result["measured_micro_batches"] == 10
    assert result["joint_steps_per_second"] > 0
    assert set(result["family_throughput"]) == set(FAMILIES)
    assert all(
        result["family_throughput"][family]["records"] == 2
        for family in FAMILIES
    )
    assert result["source_manifest_bundle_sha256"] == "a" * 64
    assert result["optimizer_updates"] == 0
    assert result["checkpoint_writes"] == 0
    assert result["checkpointable"] is False
    assert all(
        "referenced_asset_file_bytes_per_second" in result["family_throughput"][family]
        and "asset_bytes_per_second" not in result["family_throughput"][family]
        for family in FAMILIES
    )


def test_v3_loader_benchmark_sampling_is_deterministic_and_external_only(tmp_path):
    from onecore.v3.resource_benchmark import _select_loader_benchmark_rows

    manifests, _assets_root = _write_project(tmp_path / "project")
    bootstrap = {
        "id": "train-text-bootstrap",
        "split": "train",
        "task": "text",
        "data_class": "bootstrap",
        "source_url": "https://example.org/bootstrap",
        "source_id": "bootstrap",
        "source_revision": "d" * 40,
        "source_row_id_sha256": hashlib.sha256(b"bootstrap").hexdigest(),
        "text": "This bootstrap row must never enter the loader benchmark.",
    }
    rows = [
        json.loads(line)
        for line in manifests["train"].read_text(encoding="utf-8").splitlines()
    ]
    video_row = next(row for row in rows if row.get("task") == "video_caption")
    original_video_row_sha = video_row["source_row_id_sha256"]
    video_media = video_row["assets"]["video"]
    video_media["frames"] = [f"frames/extended/{index}.png" for index in range(20)]
    video_media["timestamps"] = [index * 0.04 for index in range(20)]
    video_media["frame_count"] = 20
    rows.append(bootstrap)
    manifests["train"].write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows),
        encoding="utf-8",
    )
    kwargs = {
        "max_image_megapixels": 2.0,
        "max_audio_seconds": 5.0,
        "max_video_megapixel_frames": 16.0,
        "max_video_frames": 4,
    }
    first, stats = _select_loader_benchmark_rows(manifests, **kwargs)
    second, _ = _select_loader_benchmark_rows(manifests, **kwargs)
    for split, quota in (("train", 100), ("validation", 10), ("test", 10)):
        for family in FAMILIES:
            ids_first = [row["id"] for row in first[split][family]]
            ids_second = [row["id"] for row in second[split][family]]
            assert ids_first == ids_second
            assert len(ids_first) == quota
            assert "train-text-bootstrap" not in ids_first
    assert stats["coverage"]["train"]["text"]["selected_rows"] == 100
    clipped_video = next(
        row for row in first["train"]["video"] if row["id"] == video_row["id"]
    )
    assert clipped_video["source_row_id_sha256"] == original_video_row_sha
    assert len(clipped_video["assets"]["video"]["frames"]) == 4
    assert len(clipped_video["assets"]["video"]["timestamps"]) == 4
    assert clipped_video["assets"]["video"]["frame_count"] == 4
    assert clipped_video["benchmark_view"] == {
        "transform": "prefix_frame_window_under_megapixel_frame_budget",
        "source_frame_count": 20,
        "selected_frame_count": 4,
        "source_megapixels_per_frame": 4e-06,
        "selected_megapixel_frames": 16e-06,
    }




def test_v3_joint_loader_iterates_heldout_splits_without_advancing_train_cursors(tmp_path):
    loader, _assets_root = _build_loader(tmp_path)
    with loader:
        original = loader.state_dict()
        validation = list(loader.iter_evaluation_micro_batches(
            "validation", per_family=2, seed=43,
        ))
        validation_again = list(loader.iter_evaluation_micro_batches(
            "validation", per_family=2, seed=43,
        ))
        test = list(loader.iter_evaluation_micro_batches(
            "test", per_family=2, seed=43,
        ))
        assert len(validation) == len(test) == 2 * len(FAMILIES)
        assert [item.record_id for item in validation] == [
            item.record_id for item in validation_again
        ]
        assert all(item.metadata["split"] == "validation" for item in validation)
        assert all(item.metadata["split"] == "test" for item in test)
        assert all(item.metadata["data_class"] == "external" for item in validation + test)
        assert loader.state_dict() == original
        with pytest.raises(ValueError, match="validation or test only"):
            list(loader.iter_evaluation_micro_batches("train", per_family=1))


def test_v3_heldout_evaluator_reports_validation_and_test_without_updates(tmp_path):
    import torch
    from onecore.v3.evaluation import evaluate_v3_heldout_splits

    config = V3Config(architecture_version="onecore-v3-test-fixture", width=32, unique_blocks=1,
        recurrent_cycles=2, attention_heads=4, max_sequence_length=128, text_vocab_size=512,
        vision_codebook_size=16, audio_codebook_size=8, motion_codebook_size=8, special_tokens=24,
        patch_size=8, image_size=32, audio_bins=8, audio_group_frames=2, audio_sample_rate=24000,
        audio_channels=2, max_video_frames=4, tldm_latent_slots=4, dropout=0.0)

    loader, _assets_root = _build_loader(tmp_path, config=config)
    with loader:
        from onecore.v3.checkpoint import save_v3_checkpoint
        from onecore.v3.inference import OneCoreV3Inference

        model = config.build_model().cpu()
        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
        scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.8)
        objective_loss = sum(
            parameter.float().square().mean() for parameter in model.parameters()
        )
        objective_loss.backward()
        optimizer.step()
        scheduler.step()
        loader.next_joint_micro_batches()
        checkpoint_path = tmp_path / "trained-fixture.pt"
        saved = save_v3_checkpoint(
            checkpoint_path,
            model,
            optimizer,
            scheduler,
            1,
            config,
            tokenizer_json=(tmp_path / "v3-tokenizer.json").read_bytes(),
            manifest_sha256=loader.manifest_sha256,
            data_state=loader.state_dict(),
            lineage={
                "run_id": "heldout-evaluation-fixture",
                "session": 1,
                "parent_checkpoint_sha256": None,
            },
        )
        runtime = OneCoreV3Inference.from_checkpoint(
            checkpoint_path,
            expected_checkpoint_sha256=saved["sha256"],
            device="cpu",
        )
        model = runtime.model
        before = {name: tensor.detach().clone() for name, tensor in model.state_dict().items()}
        train_state = loader.state_dict()
        rng = torch.get_rng_state().clone()
        report = evaluate_v3_heldout_splits(
            runtime,
            loader,
            per_family_records=1,
            families=FAMILIES,
            seed=91,
        )
        assert report["status"] == "evaluated"
        assert report["optimizer_updates"] == 0
        assert report["quality_certified"] is False
        assert report["checkpoint_sha256"] == saved["sha256"]
        assert report["config_sha256"] == config.fingerprint
        assert set(report["splits"]) == {"validation", "test"}
        expected_loss = {family: "language_loss" for family in FAMILIES}
        for split in ("validation", "test"):
            for family in FAMILIES:
                metrics = report["splits"][split][family]
                assert metrics["sample_count"] == 1
                assert metrics["mean_losses"][expected_loss[family]] >= 0
                assert len(metrics["record_ids_sha256"]) == 64
        assert loader.state_dict() == train_state
        assert torch.equal(torch.get_rng_state(), rng)
    for name, tensor in model.state_dict().items():
        assert torch.equal(tensor, before[name]), name
    assert all(parameter.grad is None for parameter in model.parameters())

def test_v3_joint_loader_rejects_caption_task_without_paired_text(tmp_path):
    manifests, assets_root = _write_project(tmp_path / "project")
    rows = [json.loads(line) for line in manifests["train"].read_text(encoding="utf-8").splitlines()]
    target = next(row for row in rows if row.get("task") == "image_caption")
    target.pop("caption")
    manifests["train"].write_text(
        "".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + chr(10) for row in rows),
        encoding="utf-8",
    )
    config = V3Config()
    tokenizer_path = tmp_path / "v3-tokenizer.json"
    _write_exact_v3_test_tokenizer(manifests["train"], tokenizer_path, config)
    with pytest.raises(ValueError, match="missing paired condition text"):
        V3JointDataLoader(
            manifests, assets_root, tokenizer_path, config=config,
            max_text_tokens=16, audio_window_seconds=0.001, video_window_frames=2,
        )
