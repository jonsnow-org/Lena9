import json

from onecore.data import classify_record_data, validate_manifest
from onecore.evaluate import REQUIRED_CODEBOOKS, REQUIRED_METRICS, promotion_gate
from onecore.promote import promote_candidate


def _codebook_report():
    return {
        modality: {
            "used_codes": 100, "total_codes": 256, "usage_fraction": 100 / 256,
            "assignment_count": 1000, "perplexity": 150.0, "normalized_entropy": 0.8,
            "max_code_fraction": 0.05, "dead_codes": 156,
        }
        for modality in REQUIRED_CODEBOOKS
    }


def _native_tldm_report(split, checkpoint_sha):
    families = ("text", "tool", "image", "audio", "video")
    return {
        "protocol": "onecore-native-tldm-heldout-v1",
        "split": split,
        "checkpoint_sha256": checkpoint_sha,
        "sample_cap_per_task": 16,
        "sample_counts_by_task": {
            "text": 10, "tool_use": 10, "image_caption": 10,
            "audio_text": 10, "video_caption": 10,
        },
        "sample_counts_by_family": {family: 10 for family in families},
        "per_family_masked_span_loss": {family: 1.0 for family in families},
        "masked_span_loss": 1.0,
        "sample_count": 50,
        "masked_token_count": 500,
        "skipped_short_sequences": 0,
    }


def _metrics(data_verified=True, data_kind="external_only"):
    checkpoint_sha = "a" * 64
    validation_hash = "b" * 64
    test_hash = "c" * 64
    thresholds = {}
    values = {key: 1.0 for key in REQUIRED_METRICS}
    for key in REQUIRED_METRICS:
        thresholds[key] = 2.0
        thresholds[f"test_{key}"] = 2.0
    thresholds["min_tool_execution_success_rate"] = 0.25
    thresholds["test_min_tool_execution_success_rate"] = 0.25
    thresholds["tool_behavior_regression_floor"] = 0.90
    thresholds["native_tldm_max_masked_span_loss"] = 2.0
    thresholds["test_native_tldm_max_masked_span_loss"] = 2.0
    tool_behavior = {
        "sample_count": 16,
        "execution_success_rate": 0.5,
        "valid_payload_rate": 0.75,
        "allowlisted_dispatch_rate": 0.65,
        "exact_payload_match_rate": 0.5,
        "protocol": "verified-tool-action-execution-v1",
        "sample_ids_sha256": "d" * 64,
        "per_step": {
            "1": {"sample_count": 8, "execution_success_rate": 0.5},
            "2": {"sample_count": 8, "execution_success_rate": 0.5},
        },
    }
    for modality in REQUIRED_CODEBOOKS:
        thresholds[f"min_{modality}_usage_fraction"] = 0.1
        thresholds[f"max_{modality}_max_code_fraction"] = 0.2
        thresholds[f"min_{modality}_normalized_entropy"] = 0.6
        thresholds[f"test_min_{modality}_usage_fraction"] = 0.1
        thresholds[f"test_max_{modality}_max_code_fraction"] = 0.2
        thresholds[f"test_min_{modality}_normalized_entropy"] = 0.6
    codebook_usage = _codebook_report()
    native_tldm_validation = _native_tldm_report("validation", checkpoint_sha)
    native_tldm_test = _native_tldm_report("test", checkpoint_sha)
    test_metrics = {**values, "split": "test", "checkpoint_sha256": checkpoint_sha,
        "parameter_count": 57_579_201, "real_data": data_kind == "external_only",
        "quality_thresholds_status": "approved", "quality_thresholds": thresholds,
        "tokenizer_sha256": "f" * 64, "selected_records_sha256": "e" * 64,
        "data_kind": data_kind,
        "data_classes": ["external"] if data_kind == "external_only" else [data_kind],
        "data_verified_for_promotion": data_verified,
        "modalities_tested": list(REQUIRED_METRICS), "split_manifest_sha256": test_hash,
        "codebook_usage": codebook_usage, "tool_behavior": tool_behavior,
        "native_tldm_evaluation": native_tldm_test}
    return {**values, "split": "validation", "checkpoint_sha256": checkpoint_sha,
        "parameter_count": 57_579_201, "real_data": data_kind == "external_only",
        "quality_thresholds_status": "approved",
        "tokenizer_sha256": "f" * 64, "selected_records_sha256": "d" * 64,
        "data_kind": data_kind,
        "data_classes": ["external"] if data_kind == "external_only" else [data_kind],
        "data_verified_for_promotion": data_verified,
        "modalities_tested": list(REQUIRED_METRICS), "quality_thresholds": thresholds,
        "split_manifest_sha256": validation_hash, "test_manifest_sha256": test_hash,
        "text_loss_regression_max": 1.02,
        "codebook_usage": codebook_usage, "tool_behavior": tool_behavior,
        "native_tldm_evaluation": native_tldm_validation,
        "test_metrics": test_metrics}


def test_external_only_data_can_pass_gate_when_quality_evidence_passes():
    metrics = _metrics(data_verified=True)
    passed, failures = promotion_gate(metrics, baseline=_metrics(data_verified=True))
    assert passed
    assert failures == []



def test_promotion_requires_explicitly_approved_threshold_status_for_both_splits():
    for split in ("validation", "test"):
        metrics = _metrics(data_verified=True)
        target = metrics if split == "validation" else metrics["test_metrics"]
        target["quality_thresholds_status"] = "not-approved"

        passed, failures = promotion_gate(metrics, baseline=_metrics(data_verified=True))

        assert not passed
        assert any(f"{split} promotion thresholds status is" in item for item in failures)


def test_synthetic_bootstrap_data_is_rejected_by_default():
    passed, failures = promotion_gate(_metrics(data_verified=False, data_kind="synthetic_bootstrap_diagnostic"))
    assert not passed
    assert any("verified external-only records" in failure for failure in failures)


def test_verified_synthetic_data_is_rejected_from_promotion():
    metrics = _metrics(data_verified=True, data_kind="synthetic_verified_diagnostic")
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("verified external-only records" in failure for failure in failures)


def test_gate_rejects_codebook_collapse_even_when_losses_are_below_limits():
    metrics = _metrics(data_verified=True)
    for report in (metrics["codebook_usage"]["vision"], metrics["test_metrics"]["codebook_usage"]["vision"]):
        report["usage_fraction"] = 0.01
        report["max_code_fraction"] = 0.9
        report["normalized_entropy"] = 0.1
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("vision codebook usage" in failure and "below" in failure for failure in failures)
    assert any("vision max-code fraction" in failure and "exceeds" in failure for failure in failures)
    assert any("vision normalized entropy" in failure and "below" in failure for failure in failures)


def test_verified_synthetic_manifest_requires_reference_verification_evidence(tmp_path):
    record = {"id": "math-verified-0001", "task": "text",
        "source policy": "local-owner-synthetic", "source_url": "local://onecore-verified-curriculum",
        "source label": "Generated by the OneCore verified curriculum", "split": "train",
        "data_class": "synthetic_verified",
        "verification": {"method": "exact integer arithmetic", "reference": "7 * 8 = 56"},
        "text": "Compute 7 times 8. The verified answer is 56."}
    report = validate_manifest([record], tmp_path, expected_split="train")
    assert report["valid"]
    assert classify_record_data(record) == "synthetic"



def test_gate_rejects_poor_executed_tool_performance_even_when_loss_passes():
    metrics = _metrics(data_verified=True)
    metrics["tool_behavior"]["execution_success_rate"] = 0.0
    metrics["tool_behavior"]["per_step"]["2"]["execution_success_rate"] = 0.0
    metrics["test_metrics"]["tool_behavior"]["execution_success_rate"] = 0.0
    metrics["test_metrics"]["tool_behavior"]["per_step"]["2"]["execution_success_rate"] = 0.0
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("validation tool execution success rate" in failure for failure in failures)
    assert any("validation tool workflow step 2 success rate" in failure for failure in failures)
    assert any("test tool execution success rate" in failure for failure in failures)



def test_gate_rejects_tool_regression_against_same_fixed_heldout_cases():
    metrics = _metrics(data_verified=True)
    baseline = _metrics(data_verified=True)
    baseline["tool_behavior"]["execution_success_rate"] = 0.8
    baseline["tool_behavior"]["per_step"]["1"]["execution_success_rate"] = 0.8
    baseline["tool_behavior"]["per_step"]["2"]["execution_success_rate"] = 0.8
    baseline["test_metrics"]["tool_behavior"]["execution_success_rate"] = 0.8
    baseline["test_metrics"]["tool_behavior"]["per_step"]["1"]["execution_success_rate"] = 0.8
    baseline["test_metrics"]["tool_behavior"]["per_step"]["2"]["execution_success_rate"] = 0.8

    passed, failures = promotion_gate(metrics, baseline=baseline)
    assert not passed
    assert any("validation tool execution success rate regressed" in item for item in failures)
    assert any("validation tool workflow step 2 execution success rate regressed" in item for item in failures)
    assert any("test tool execution success rate regressed" in item for item in failures)


def test_gate_requires_identical_tool_cases_before_comparing_baseline():
    metrics = _metrics(data_verified=True)
    baseline = _metrics(data_verified=True)
    baseline["tool_behavior"]["sample_ids_sha256"] = "e" * 64
    passed, failures = promotion_gate(metrics, baseline=baseline)
    assert not passed
    assert any("validation tool evaluation does not use the same fixed held-out cases" in item for item in failures)


def test_gate_requires_independent_native_tldm_metrics_for_both_splits():
    metrics = _metrics(data_verified=True)
    metrics.pop("native_tldm_evaluation")
    metrics["test_metrics"].pop("native_tldm_evaluation")
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("validation native T-LDM held-out evaluation report is missing" in item for item in failures)
    assert any("test native T-LDM held-out evaluation report is missing" in item for item in failures)


def test_gate_rejects_native_tldm_masked_span_loss_above_separate_limit():
    metrics = _metrics(data_verified=True)
    metrics["native_tldm_evaluation"]["masked_span_loss"] = 2.5
    metrics["test_metrics"]["native_tldm_evaluation"]["masked_span_loss"] = 2.5
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("validation native T-LDM masked-span loss" in item for item in failures)
    assert any("test native T-LDM masked-span loss" in item for item in failures)


def test_gate_rejects_tldm_heldout_family_with_insufficient_examples():
    metrics = _metrics(data_verified=True)
    metrics["native_tldm_evaluation"]["sample_counts_by_family"]["video"] = 9
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("fewer than 10 held-out video examples" in item for item in failures)



def test_tool_evaluation_accepts_the_specified_sixteen_examples_and_four_per_step():
    metrics = _metrics(data_verified=True)
    assert metrics["tool_behavior"]["sample_count"] == 16
    assert metrics["tool_behavior"]["per_step"]["1"]["sample_count"] == 8
    passed, failures = promotion_gate(metrics, baseline=_metrics(data_verified=True))
    assert passed, failures


def test_tool_evaluation_rejects_fewer_than_sixteen_examples():
    metrics = _metrics(data_verified=True)
    metrics["tool_behavior"]["sample_count"] = 9
    metrics["test_metrics"]["tool_behavior"]["sample_count"] = 9
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("fewer than 16 held-out examples" in item for item in failures)


def test_tool_evaluation_requires_both_workflow_steps_to_be_present():
    metrics = _metrics(data_verified=True)
    metrics["tool_behavior"]["per_step"]["2"]["sample_count"] = 0
    metrics["test_metrics"]["tool_behavior"]["per_step"]["2"]["sample_count"] = 0
    passed, failures = promotion_gate(metrics)
    assert not passed
    assert any("workflow step 2 has fewer than 4 held-out examples" in item for item in failures)



def test_promote_candidate_uses_the_same_baseline_required_by_the_gate(tmp_path):
    metrics = _metrics(data_verified=True)
    baseline = _metrics(data_verified=True)
    metrics_path = tmp_path / "evaluation.json"
    baseline_path = tmp_path / "evaluation.baseline.json"
    registry_path = tmp_path / "model-registry.json"
    metrics_path.write_text(json.dumps(metrics), encoding="utf-8")
    baseline_path.write_text(json.dumps(baseline), encoding="utf-8")

    result = promote_candidate(metrics_path, registry_path, baseline_path)

    assert result["promoted"] is True
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    candidate = registry["candidates"][0]
    assert candidate["baseline_evaluation_id"] == baseline.get("evaluation_id")
    assert candidate["baseline_checkpoint_sha256"] == baseline["checkpoint_sha256"]


def test_promote_candidate_cannot_skip_the_required_baseline(tmp_path):
    metrics_path = tmp_path / "evaluation.json"
    registry_path = tmp_path / "model-registry.json"
    metrics_path.write_text(json.dumps(_metrics(data_verified=True)), encoding="utf-8")

    try:
        promote_candidate(metrics_path, registry_path)
    except RuntimeError as exc:
        assert "approved-comparison baseline evaluation is required" in str(exc)
    else:
        raise AssertionError("promotion unexpectedly succeeded without a baseline")


def test_text_loss_regression_allows_exactly_two_percent_but_rejects_more():
    metrics = _metrics(data_verified=True)
    baseline = _metrics(data_verified=True)
    metrics["text_loss"] = 1.02
    metrics["test_metrics"]["text_loss"] = 1.02
    passed, failures = promotion_gate(metrics, baseline=baseline)
    assert passed, failures

    metrics["text_loss"] = 1.021
    metrics["test_metrics"]["text_loss"] = 1.021
    passed, failures = promotion_gate(metrics, baseline=baseline)
    assert not passed
    assert any("validation text loss" in item and "exceeds 1.02" in item for item in failures)
    assert any("test text loss" in item and "exceeds 1.02" in item for item in failures)
