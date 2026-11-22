import math

import pytest
import torch

from onecore.evaluate import (
    _text_language_bucket, _token_weighted_mean_loss, _tldm_masked_span_loss, codebook_assignment_report,
    select_evaluation_records, select_tldm_evaluation_records,
)
from onecore.config import ModelConfig
from onecore.model import OneCore


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
