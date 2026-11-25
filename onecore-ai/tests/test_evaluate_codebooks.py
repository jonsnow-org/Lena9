import math

import pytest
import torch

from onecore.evaluate import (
    _check_text_loss_regression, _check_tool_behavior, _text_language_bucket,
    _modalities_tested,
    _token_weighted_mean_loss, _tldm_masked_span_loss, codebook_assignment_report,
    select_evaluation_records, select_tldm_evaluation_records,
    select_verified_tool_evaluation_records, _check_tool_behavior_regression,
)
from onecore.config import ModelConfig
from onecore.model import OneCore


def test_image_caption_records_count_toward_image_reconstruction_modality():
    assert _modalities_tested({"image_caption": 12}) == ["image_reconstruction"]
    assert _modalities_tested({"image_reconstruction": 3}) == ["image_reconstruction"]


def test_codebook_assignment_report_has_expected_entropy_perplexity_and_dead_codes():
    report = codebook_assignment_report(torch.tensor([0, 0, 1, 1, 2, 2]), codebook_size=4)
    assert report["used_codes"] == 3
    assert report["dead_codes"] == 1
    assert report["usage_fraction"] == pytest.approx(0.75)
    assert report["max_code_fraction"] == pytest.approx(1 / 3)
    assert report["perplexity"] == pytest.approx(3.0)
    assert report["normalized_entropy"] == pytest.approx(math.log(3) / math.log(4))


def test_codebook_assignment_report_rejects_out_of_range_ids():
    with pytest.raises(ValueError, match="outside its codebook range"):
        codebook_assignment_report(torch.tensor([0, 4]), codebook_size=4)


def test_evaluation_can_select_any_available_data_class():
    records = [
        {"id": "bootstrap-text", "task": "text", "data_class": "bootstrap"},
        {"id": "external-text", "task": "text", "data_class": "external"},
        {"id": "owner-local", "task": "text", "data_class": "owner_curated"},
    ]
    external = select_evaluation_records(records, {"external"})
    bootstrap = select_evaluation_records(records, {"bootstrap"})
    owner = select_evaluation_records(records, {"owner_curated"})
    assert [item["id"] for item in external] == ["external-text"]
    assert [item["id"] for item in bootstrap] == ["bootstrap-text"]
    assert [item["id"] for item in owner] == ["owner-local"]


def test_evaluation_defaults_to_external_records_only():
    records = [
        {"id": "bootstrap-text", "task": "text", "data_class": "bootstrap"},
        {"id": "external-text", "task": "text", "data_class": "external"},
        {"id": "owner-local", "task": "text", "data_class": "owner_curated"},
    ]
    assert [item["id"] for item in select_evaluation_records(records)] == ["external-text"]


def test_evaluation_filter_rejects_empty_subsets():
    with pytest.raises(ValueError, match="contains no records"):
        select_evaluation_records(
            [{"id": "bootstrap", "task": "text", "data_class": "bootstrap"}],
            {"external"},
        )


def test_tldm_evaluation_selection_is_deterministic_and_task_stratified():
    records = [
        {"id": f"text-{index:03}", "task": "text"}
        for index in range(24)
    ] + [
        {"id": f"image-{index:03}", "task": "image_caption"}
        for index in range(19)
    ] + [
        {"id": f"video-{index:03}", "task": "video_reconstruction"}
        for index in range(8)
    ]
    first = select_tldm_evaluation_records(records, "validation", per_task_limit=5)
    second = select_tldm_evaluation_records(list(reversed(records)), "validation", per_task_limit=5)

    assert [item["id"] for item in first] == [item["id"] for item in second]
    assert sum(item["task"] == "text" for item in first) == 5
    assert sum(item["task"] == "image_caption" for item in first) == 5
    assert sum(item["task"] == "video_reconstruction" for item in first) == 5


def test_tldm_masked_span_evaluation_is_deterministic():
    cfg = ModelConfig(
        width=32, unique_blocks=1, recurrent_cycles=1, attention_heads=4,
        max_sequence_length=32, text_vocab_size=64, vision_codebook_size=8,
        audio_codebook_size=4, motion_codebook_size=4, special_tokens=24,
        patch_size=4, image_size=8, audio_bins=8, audio_group_frames=2,
        max_video_frames=2, dropout=0.0,
    )
    model = OneCore(cfg).eval()
    sequence = torch.tensor([[0, 14, 20, 21, 22, 23, 24, 25, 26, 27, 28, 1]])
    first = _tldm_masked_span_loss(model, sequence, "heldout-record-1", "validation")
    second = _tldm_masked_span_loss(model, sequence, "heldout-record-1", "validation")

    assert first[1] > 0
    assert first[0] == pytest.approx(second[0])
    assert first[1] == second[1]



def test_text_language_bucket_prefers_explicit_arabic_and_english_metadata():
    assert _text_language_bucket({"task": "text", "language": "ar", "text": "Hello"}) == (
        "arabic", "metadata"
    )
    assert _text_language_bucket({"task": "text", "lang": "en-US", "text": "مرحبا"}) == (
        "english", "metadata"
    )


def test_text_language_bucket_reports_unlabeled_script_without_claiming_language():
    assert _text_language_bucket({"task": "text", "text": "مرحبا بالعالم"}) == (
        "arabic_script_unlabeled", "unicode_script"
    )
    assert _text_language_bucket({"task": "text", "text": "Hello world"}) == (
        "latin_script_unlabeled", "unicode_script"
    )
    assert _text_language_bucket({"task": "text", "text": "Hello مرحبا"}) == (
        "mixed_or_unknown", "unicode_script"
    )


def test_text_language_bucket_excludes_tagged_code_from_natural_language_metrics():
    assert _text_language_bucket({
        "task": "text", "code_language": "Python", "text": "print('hello')"
    }) == ("code_excluded", "metadata")



def test_language_loss_is_weighted_by_target_tokens_not_record_count():
    # The longer second record contributes three times as many target tokens.
    assert _token_weighted_mean_loss([2.0, 4.0], [10, 30]) == pytest.approx(3.5)
    assert _token_weighted_mean_loss([2.0, 4.0], [10, 30]) != pytest.approx(3.0)


def test_token_weighted_language_loss_rejects_invalid_inputs():
    with pytest.raises(ValueError, match="matching lengths"):
        _token_weighted_mean_loss([2.0], [10, 20])
    with pytest.raises(ValueError, match="positive target-token counts"):
        _token_weighted_mean_loss([2.0], [0])



def test_token_weighted_language_loss_rejects_non_finite_losses():
    with pytest.raises(ValueError, match="record losses must be finite"):
        _token_weighted_mean_loss([float("nan")], [10])



def test_tool_promotion_requires_sixteen_examples_and_four_per_step():
    failures = []
    report = {
        "data_class": "synthetic_verified",
        "evaluation_role": "engineering_only",
        "split": "validation",
        "sample_count": 15,
        "execution_success_rate": 1.0,
        "per_step": {
            "1": {"sample_count": 3, "execution_success_rate": 1.0},
            "2": {"sample_count": 4, "execution_success_rate": 1.0},
        },
    }
    _check_tool_behavior("validation", report, {"min_tool_execution_success_rate": 0.9},
                         "min_tool_execution_success_rate", failures)
    assert any("fewer than 16" in failure for failure in failures)
    assert any("step 1 has fewer than 4" in failure for failure in failures)


def test_tool_promotion_accepts_spec_minimum_evidence():
    failures = []
    report = {
        "data_class": "synthetic_verified",
        "evaluation_role": "engineering_only",
        "split": "validation",
        "sample_count": 16,
        "execution_success_rate": 0.95,
        "per_step": {
            "1": {"sample_count": 8, "execution_success_rate": 0.95},
            "2": {"sample_count": 8, "execution_success_rate": 0.95},
        },
    }
    _check_tool_behavior("validation", report, {"min_tool_execution_success_rate": 0.9},
                         "min_tool_execution_success_rate", failures)
    assert failures == []


def test_text_loss_regression_enforces_v2_ratio_on_identical_evidence():
    baseline = {
        "split": "validation",
        "tokenizer_sha256": "a" * 64,
        "split_manifest_sha256": "b" * 64,
        "selected_records_sha256": "c" * 64,
        "text_loss": 2.0,
    }
    current = dict(baseline, text_loss=2.04)
    failures = []
    _check_text_loss_regression("validation", current, baseline, 1.02, failures)
    assert failures == []

    current["text_loss"] = 2.041
    failures = []
    _check_text_loss_regression("validation", current, baseline, 1.02, failures)
    assert any("exceeds 1.02 × baseline" in failure for failure in failures)


def test_text_loss_regression_rejects_different_tokenizer_or_manifest():
    baseline = {
        "split": "test",
        "tokenizer_sha256": "a" * 64,
        "split_manifest_sha256": "b" * 64,
        "selected_records_sha256": "c" * 64,
        "text_loss": 2.0,
    }
    current = dict(baseline, tokenizer_sha256="d" * 64)
    failures = []
    _check_text_loss_regression("test", current, baseline, 1.02, failures)
    assert any("does not match current tokenizer_sha256" in failure for failure in failures)


def test_tool_behavior_selection_uses_only_verified_synthetic_engineering_examples(tmp_path):
    from onecore.data import read_manifest
    from onecore.tool_episodes import generate_tool_episodes

    root = tmp_path / "onecore-ai"
    data = root / "data"
    data.mkdir(parents=True)
    (data / "assets").mkdir()
    for split in ("train", "validation", "test"):
        (data / f"{split}.jsonl").write_text("", encoding="utf-8")
    generate_tool_episodes(root, {"train": 1, "validation": 8, "test": 8})
    records = read_manifest(data / "validation.jsonl")
    external = {
        **records[0],
        "id": "external-tool-row",
        "data_class": "external",
        "source_id": "external-tools",
        "source_revision": "a" * 40,
        "source_row_id_sha256": "b" * 64,
        "source_url": "https://example.org/tools",
    }
    selected = select_verified_tool_evaluation_records(records + [external])

    assert len(selected) == 16
    assert all(record["data_class"] == "synthetic_verified" for record in selected)
    assert all(record["id"] != "external-tool-row" for record in selected)


def test_tool_regression_requires_engineering_only_verified_metadata():
    report = {
        "protocol": "verified-tool-action-execution-v1",
        "data_class": "synthetic_verified",
        "evaluation_role": "engineering_only",
        "split": "validation",
        "sample_ids_sha256": "a" * 64,
        "sample_count": 16,
        "execution_success_rate": 0.95,
        "per_step": {
            "1": {"sample_count": 8, "execution_success_rate": 0.95},
            "2": {"sample_count": 8, "execution_success_rate": 0.95},
        },
    }
    failures = []
    _check_tool_behavior_regression("validation", report, dict(report), 0.9, failures)
    assert failures == []

    wrong_class = dict(report, data_class="external")
    failures = []
    _check_tool_behavior_regression("validation", wrong_class, report, 0.9, failures)
    assert any("data class must be synthetic_verified" in item for item in failures)
