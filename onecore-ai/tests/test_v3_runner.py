import json

import pytest

from onecore.v3.runner import _learning_rate_multiplier, _validate_resource_evidence


def _resource_report():
    families = ("text", "tool", "image", "audio", "video")
    return {
        "format_version": 1,
        "status": "measured",
        "benchmark_kind": "cpu_v3_joint_loader_plus_per_family_diagnostics_and_joint_objective_without_optimizer_step",
        "config_sha256": "a" * 64,
        "manifest_bundle_sha256": "b" * 64,
        "train_manifest_sha256": "c" * 64,
        "tokenizer": {"tokenizer_sha256": "d" * 64},
        "github_run_id": "123456",
        "github_repository": "jonsnow-org/Lena9",
        "github_ref": "refs/heads/research/onecore-v3-implementation",
        "github_sha": "a" * 40,
        "cpu": {"cuda_available": False, "threads": 4},
        "optimizer_updates": 0,
        "model_report": {"config_sha256": "a" * 64, "trainable_parameters": 39_906_568},
        "shape_distributions": {
            "image_width": {"count": 100, "min": 128.0, "median": 512.0, "p95": 1024.0, "max": 2048.0},
            "image_height": {"count": 100, "min": 128.0, "median": 512.0, "p95": 1024.0, "max": 2048.0},
            "video_width": {"count": 100, "min": 320.0, "median": 1280.0, "p95": 1920.0, "max": 1920.0},
            "video_height": {"count": 100, "min": 240.0, "median": 720.0, "p95": 1080.0, "max": 1080.0},
        },
        "manifest_gate": {
            "passed": True,
            "coverage": {
                "train": {family: 100 for family in families},
                "validation": {family: 10 for family in families},
                "test": {family: 10 for family in families},
            },
        },
        "benchmarks": [{"status": "success", "family": family} for family in families],
        "joint_training_memory": {
            "status": "success",
            "optimizer_updates": 0,
            "optimizer_step_executed": False,
            "optimizer_state_allocated": True,
            "optimizer_state_bytes": 4096,
            "peak_rss_bytes": 8192,
            "cpu_threads": 4,
        },
        "data_loader_benchmark": {
            "status": "success",
            "source_manifest_bundle_sha256": "b" * 64,
            "tokenizer_train_manifest_sha256": "c" * 64,
            "tokenizer_sha256": "d" * 64,
            "benchmark_manifest_view": True,
            "checkpointable": False,
            "optimizer_updates": 0,
            "checkpoint_writes": 0,
            "cpu_threads": 4,
            "measured_joint_steps": 20,
            "joint_steps_per_second": 0.1,
            "peak_rss_bytes": 4096,
            "sample_selection": {
                "coverage": {
                    "train": {family: {"eligible_external_rows_within_caps": 100, "rejected_by_resource_caps": 0, "selected_rows": 100} for family in families},
                    "validation": {family: {"eligible_external_rows_within_caps": 10, "rejected_by_resource_caps": 0, "selected_rows": 10} for family in families},
                    "test": {family: {"eligible_external_rows_within_caps": 10, "rejected_by_resource_caps": 0, "selected_rows": 10} for family in families},
                }
            },
            "family_throughput": {
                family: {"records_per_second": 1.0, "units_per_second": 2.0}
                for family in families
            },
        },
        "memory_accounting": {
            "observed_process_tree_peak_rss_bytes": 16384,
            "conservative_process_tree_rss_upper_bound_bytes": 24576,
        },
    }


def _resource_metadata():
    return {
        "format_version": 1,
        "repository": "jonsnow-org/Lena9",
        "run_id": 123456,
        "workflow_id": 419034892,
        "workflow_path": ".github/workflows/onecore-ci.yml",
        "event": "workflow_dispatch",
        "run_status": "completed",
        "run_conclusion": "success",
        "head_branch": "research/onecore-v3-implementation",
        "head_sha": "a" * 40,
        "verify_job_id": 1,
        "benchmark_job_id": 2,
        "artifact_id": 987,
        "artifact_name": "onecore-v3-resource-benchmark-123456",
        "artifact_size_bytes": 4096,
        "artifact_digest": "sha256:" + "b" * 64,
        "artifact_expired": False,
    }


def _validate(path, metadata_path=None):
    if metadata_path is None and path is not None:
        metadata_path = path.with_name(path.stem + ".artifact.json")
        metadata_path.write_text(json.dumps(_resource_metadata()), encoding="utf-8")
    return _validate_resource_evidence(
        path,
        artifact_metadata_path=metadata_path,
        config_fingerprint="a" * 64,
        manifest_sha256="b" * 64,
        train_manifest_sha256="c" * 64,
        tokenizer_sha256="d" * 64,
        threads=4,
    )


def test_v3_schedule_has_explicit_linear_warmup_and_cosine_floor():
    assert _learning_rate_multiplier(0, warmup_steps=200, total_steps=20_000) == pytest.approx(1 / 200)
    assert _learning_rate_multiplier(199, warmup_steps=200, total_steps=20_000) == pytest.approx(1.0)
    assert _learning_rate_multiplier(20_000, warmup_steps=200, total_steps=20_000) == pytest.approx(0.1)


def test_v3_schedule_reaches_floor_without_becoming_negative():
    values = [
        _learning_rate_multiplier(step, warmup_steps=10, total_steps=100)
        for step in (10, 25, 50, 75, 100, 150)
    ]
    assert values == sorted(values, reverse=True)
    assert min(values) == pytest.approx(0.1)


def test_v3_training_requires_a_measured_resource_report(tmp_path):
    report_path = tmp_path / "resource.json"
    report_path.write_text(json.dumps(_resource_report()), encoding="utf-8")
    digest = _validate(report_path)
    assert len(digest) == 64
    with pytest.raises(ValueError, match="resource benchmark report is supplied"):
        _validate(None)


def test_v3_resource_evidence_must_match_exact_config_manifest_and_tokenizer(tmp_path):
    for key, value, message in (
        ("config_sha256", "f" * 64, "config fingerprint mismatch"),
        ("manifest_bundle_sha256", "f" * 64, "manifest bundle fingerprint mismatch"),
        ("train_manifest_sha256", "f" * 64, "train-manifest fingerprint mismatch"),
    ):
        report = _resource_report()
        report[key] = value
        path = tmp_path / f"{key}.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        with pytest.raises(ValueError, match=message):
            _validate(path)

    report = _resource_report()
    report["tokenizer"]["tokenizer_sha256"] = "f" * 64
    path = tmp_path / "tokenizer.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="tokenizer SHA-256 mismatch"):
        _validate(path)


def test_v3_resource_evidence_rejects_cuda_or_optimizer_updates(tmp_path):
    report = _resource_report()
    report["cpu"]["cuda_available"] = True
    path = tmp_path / "cuda.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="CUDA is unavailable"):
        _validate(path)

    report = _resource_report()
    report["optimizer_updates"] = 1
    path = tmp_path / "updates.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="zero optimizer updates"):
        _validate(path)


def test_v3_resource_evidence_rejects_incomplete_or_nonpositive_measurements(tmp_path):
    report = _resource_report()
    report["data_loader_benchmark"]["joint_steps_per_second"] = 0
    path = tmp_path / "throughput.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="positive measured production loader throughput"):
        _validate(path)

    report = _resource_report()
    report["joint_training_memory"]["optimizer_step_executed"] = True
    path = tmp_path / "joint-step.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="zero-update CPU measurement"):
        _validate(path)

    report = _resource_report()
    report["manifest_gate"]["coverage"]["validation"]["image"] = 9
    path = tmp_path / "coverage.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="coverage is below quota"):
        _validate(path)



def test_v3_resource_evidence_requires_exactly_one_successful_case_per_family(tmp_path):
    for cases in (
        [{"status": "success", "family": family} for family in ("text", "tool", "image", "audio")],
        [{"status": "success", "family": family} for family in ("text", "tool", "image", "audio", "text")],
    ):
        report = _resource_report()
        report["benchmarks"] = cases
        path = tmp_path / f"cases-{len(cases)}-{cases[-1]['family']}.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        with pytest.raises(ValueError, match="exactly one successful case for each of the five families"):
            _validate(path)


def test_v3_resource_evidence_requires_complete_loader_sample_quotas_and_family_rates(tmp_path):
    report = _resource_report()
    report["data_loader_benchmark"]["sample_selection"]["coverage"]["train"]["video"]["selected_rows"] = 16
    path = tmp_path / "video-quota.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="selected sample is below quota: train/video"):
        _validate(path)

    report = _resource_report()
    del report["data_loader_benchmark"]["family_throughput"]["audio"]
    path = tmp_path / "missing-family-rate.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="throughput for all five families"):
        _validate(path)

    report = _resource_report()
    report["data_loader_benchmark"]["family_throughput"]["video"]["units_per_second"] = 0
    path = tmp_path / "video-rate.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="positive measured video units per second"):
        _validate(path)


def test_v3_resource_evidence_rejects_inconsistent_process_tree_memory_bound(tmp_path):
    report = _resource_report()
    report["memory_accounting"]["conservative_process_tree_rss_upper_bound_bytes"] = 100
    path = tmp_path / "rss-bound.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="upper bound is below the observed peak"):
        _validate(path)



def test_v3_resource_evidence_requires_complete_valid_image_and_video_dimensions(tmp_path):
    for key in ("image_width", "image_height", "video_width", "video_height"):
        report = _resource_report()
        del report["shape_distributions"][key]
        path = tmp_path / f"missing-{key}.json"
        path.write_text(json.dumps(report), encoding="utf-8")
        with pytest.raises(ValueError, match=f"missing {key} dimension distribution"):
            _validate(path)

    report = _resource_report()
    report["shape_distributions"]["video_width"]["min"] = 0
    path = tmp_path / "nonpositive-video-width.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="invalid positive min"):
        _validate(path)

    report = _resource_report()
    report["shape_distributions"]["video_height"]["p95"] = 700.0
    path = tmp_path / "unordered-video-height.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="quantiles are not ordered"):
        _validate(path)

    report = _resource_report()
    report["shape_distributions"]["video_width"]["median"] = 1280.5
    path = tmp_path / "fractional-video-width.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="integer pixel values"):
        _validate(path)

    report = _resource_report()
    report["shape_distributions"]["video_width"]["count"] = 99
    path = tmp_path / "mismatched-video-dimensions.json"
    path.write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError, match="video width/height dimension counts do not match"):
        _validate(path)


def test_v3_resource_evidence_requires_verified_artifact_metadata_sidecar(tmp_path):
    path = tmp_path / "resource.json"
    path.write_text(json.dumps(_resource_report()), encoding="utf-8")
    with pytest.raises(ValueError, match="metadata sidecar is required"):
        _validate_resource_evidence(
            path,
            artifact_metadata_path=None,
            config_fingerprint="a" * 64,
            manifest_sha256="b" * 64,
            train_manifest_sha256="c" * 64,
            tokenizer_sha256="d" * 64,
            threads=4,
        )
