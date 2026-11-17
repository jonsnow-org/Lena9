from __future__ import annotations

from onecore.curriculum_reference import verify_record
from onecore.data import read_manifest
from onecore.tool_episodes import TOOL_EPISODE_VERSION, generate_tool_episodes


def test_tool_episodes_are_replay_verified_split_disjoint_and_idempotent(tmp_path):
    root = tmp_path / "onecore-ai"
    data = root / "data"
    (data / "assets").mkdir(parents=True)
    for split in ("train", "validation", "test"):
        (data / f"{split}.jsonl").write_text("", encoding="utf-8")

    counts = {"train": 3, "validation": 2, "test": 2}
    report = generate_tool_episodes(root, counts)
    assert report["status"] == "generated"
    assert report["records_added"] == {split: count * 2 for split, count in counts.items()}

    prices = {}
    for split in ("train", "validation", "test"):
        records = [
            row for row in read_manifest(data / f"{split}.jsonl")
            if row.get("curriculum_version") == TOOL_EPISODE_VERSION
        ]
        assert len(records) == counts[split] * 2
        assert all(verify_record(row) for row in records)
        grouped = {}
        for row in records:
            grouped.setdefault(row["episode_id"], []).append(row)
        assert len(grouped) == counts[split]
        for steps in grouped.values():
            steps.sort(key=lambda row: row["episode_step_index"])
            assert [row["episode_step_index"] for row in steps] == [1, 2]
            assert steps[0]["problem"]["history"] == []
            assert steps[1]["problem"]["history"]
            assert steps[1]["history_trace"] in steps[1]["prompt"]
            assert steps[0]["episode_task"] == steps[1]["episode_task"]
        prices[split] = {row["problem"]["price"] for row in records}

    assert prices["train"].isdisjoint(prices["validation"])
    assert prices["train"].isdisjoint(prices["test"])
    assert prices["validation"].isdisjoint(prices["test"])

    repeated = generate_tool_episodes(root, counts)
    assert repeated["status"] == "already-present"
    assert repeated["records_added"] == {"train": 0, "validation": 0, "test": 0}
