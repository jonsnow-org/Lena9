import math

import pytest
import torch

from onecore.evaluate import codebook_assignment_report, select_evaluation_records


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
