from __future__ import annotations

from onecore.curriculum_reference import canonical_json
from onecore.data import read_manifest
from onecore.tool_episodes import generate_tool_episodes
from onecore.tool_eval import evaluate_tool_behavior


def _validation_records(root):
    data = root / "data"
    data.mkdir(parents=True, exist_ok=True)
    (data / "assets").mkdir(exist_ok=True)
    for split in ("train", "validation", "test"):
        (data / f"{split}.jsonl").write_text("", encoding="utf-8")
    generate_tool_episodes(root, {"train": 2, "validation": 8, "test": 8})
    return read_manifest(data / "validation.jsonl")


def test_tool_behavior_scores_actual_results_and_balances_workflow_steps(tmp_path):
    records = _validation_records(tmp_path / "onecore-ai")

    def exact_call(record):
        return {
            "payload": canonical_json(record["problem"]["payload"]),
            "execution": record["expected_tool_result"],
        }

    report = evaluate_tool_behavior(records, exact_call, max_examples=8)
    assert report["sample_count"] == 8
    assert report["valid_payload_rate"] == 1.0
    assert report["allowlisted_dispatch_rate"] == 1.0
    assert report["execution_success_rate"] == 1.0
    assert report["exact_payload_match_rate"] == 1.0
    assert set(report["per_step"]) == {"1", "2"}
    assert all(item["sample_count"] == 4 for item in report["per_step"].values())


def test_tool_behavior_fails_closed_on_invalid_generated_json(tmp_path):
    records = _validation_records(tmp_path / "onecore-ai")
    report = evaluate_tool_behavior(
        records,
        lambda _record: {"payload": "not-json", "execution": {}},
        max_examples=6,
    )
    assert report["sample_count"] == 6
    assert report["valid_payload_count"] == 0
    assert report["execution_success_rate"] == 0.0
    assert report["error_types"] == {"InvalidJSON": 6}
