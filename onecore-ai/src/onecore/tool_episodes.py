from __future__ import annotations

import hashlib
import json
import os
import random
import tempfile
from pathlib import Path
from typing import Any

from .curriculum_reference import (
    canonical_json,
    make_verification,
    render_answer,
    render_tool_history,
    solve,
    verify_record,
)
from .data import read_manifest, validate_manifest
from .tool_runtime import ToolRuntime


TOOL_EPISODE_VERSION = "onecore-tool-episodes-v1"
DEFAULT_EPISODE_COUNTS = {"train": 256, "validation": 64, "test": 64}
_SPLIT_PRICE_BASE = {"train": 1_000, "validation": 100_000, "test": 200_000}
_SPLIT_SEED = {"train": 20261115, "validation": 21261115, "test": 22261115}
_DISCOUNT_PERCENTS = (5, 10, 12, 15, 20, 25, 30, 40, 50)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _episode_records(split: str, index: int) -> list[dict[str, Any]]:
    rng = random.Random(_SPLIT_SEED[split] + index)
    episode_id = f"{TOOL_EPISODE_VERSION}-{split}-{index:06d}"
    price = _SPLIT_PRICE_BASE[split] + index * 100
    percent = rng.choice(_DISCOUNT_PERCENTS)
    task = f"احسب السعر النهائي لمنتج سعره {price} بعد خصم {percent}%."

    first_payload = {
        "name": "calculator",
        "arguments": {"expression": f"{price} * {percent} / 100"},
    }
    first_result = ToolRuntime().dispatch(first_payload)
    discount = float(first_result["result"]["result"])
    if not discount.is_integer():
        raise ValueError("generated discount is not an exact integer")
    second_payload = {
        "name": "calculator",
        "arguments": {"expression": f"{price} - {format(discount, '.10g')}"},
    }

    history: list[dict[str, Any]] = []
    actions = (first_payload, second_payload)
    rows: list[dict[str, Any]] = []
    for step_index, payload in enumerate(actions, 1):
        history_trace = render_tool_history(history)
        if step_index == 1:
            prompt = (
                f"{task}\nسجل التنفيذ السابق: لا توجد خطوات سابقة.\n"
                "المطلوب الآن: نفّذ الخطوة 1/2 لحساب مبلغ الخصم باستعمال calculator. "
                "أخرج JSON لاستدعاء الأداة فقط."
            )
        else:
            prompt = (
                f"{task}\nسجل التنفيذ السابق:\n{history_trace}\n"
                f"المطلوب الآن: اطرح نتيجة الخصم السابقة من السعر الأصلي {price} "
                "باستعمال calculator. أخرج JSON لاستدعاء الأداة فقط."
            )
        problem = {
            "episode_id": episode_id,
            "price": price,
            "discount_percent": percent,
            "step_index": step_index,
            "history": list(history),
            "payload": payload,
        }
        reference = "tool.discount_workflow_step.v1"
        expected = solve(reference, problem)
        record = {
            "id": f"{episode_id}-step-{step_index}",
            "task": "tool_use",
            "source_url": f"local://{TOOL_EPISODE_VERSION}",
            "split": split,
            "data_class": "synthetic_verified",
            "curriculum_version": TOOL_EPISODE_VERSION,
            "group_id": episode_id,
            "domain": "tool_workflow",
            "difficulty": "intermediate",
            "problem": problem,
            "answer": render_answer(reference, expected),
            "verification": make_verification(reference, problem, expected),
            "prompt": prompt,
            "response": json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            "expected_tool_result": expected,
            "episode_id": episode_id,
            "episode_task": task,
            "episode_step_index": step_index,
            "episode_step_count": 2,
            "history_trace": history_trace,
        }
        if not verify_record(record):
            raise ValueError(f"generated tool episode failed replay verification: {record['id']}")
        rows.append(record)
        history.append({"payload": payload, "result": expected})
    return rows


def _atomic_append(path: Path, rows: list[dict[str, Any]], split: str) -> int:
    current_records = read_manifest(path)
    by_id = {str(row.get("id", "")): row for row in current_records}
    additions: list[dict[str, Any]] = []
    for row in rows:
        prior = by_id.get(str(row["id"]))
        if prior is None:
            additions.append(row)
            continue
        comparable = {key: value for key, value in prior.items() if key != "_line"}
        if canonical_json(comparable) != canonical_json(row):
            raise ValueError(f"tool episode ID collision with different content: {row['id']}")

    if additions:
        original = path.read_text(encoding="utf-8")
        if original and not original.endswith("\n"):
            original += "\n"
        fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.tool-episodes-", dir=path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
                stream.write(original)
                for row in additions:
                    stream.write(json.dumps(
                        row, ensure_ascii=False, sort_keys=True, separators=(",", ":")
                    ) + "\n")
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp_name, path)
        except Exception:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
            raise

    manifest = read_manifest(path)
    report = validate_manifest(manifest, path.parent / "assets", expected_split=split)
    if not report["valid"]:
        raise ValueError(
            f"tool episode manifest validation failed for {split}: "
            + "; ".join(report["errors"][:20])
        )
    return len(additions)


def generate_tool_episodes(
    project_root: str | Path,
    episode_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Append verified two-step calculator trajectories to each isolated split.

    Step two receives the exact result produced by the allowlisted calculator in
    step one. The reference solver reconstructs expected calls and replays prior
    actions. Writes are atomic and idempotent.
    """
    root = Path(project_root).resolve()
    data_root = root / "data"
    assets_root = data_root / "assets"
    assets_root.mkdir(parents=True, exist_ok=True)
    counts = dict(DEFAULT_EPISODE_COUNTS if episode_counts is None else episode_counts)
    if set(counts) != {"train", "validation", "test"}:
        raise ValueError("episode_counts must specify train, validation and test")
    counts = {split: int(counts[split]) for split in ("train", "validation", "test")}
    if any(count < 1 or count > 10_000 for count in counts.values()):
        raise ValueError("each split episode count must be between 1 and 10000")

    added: dict[str, int] = {}
    hashes: dict[str, str] = {}
    for split in ("train", "validation", "test"):
        manifest = data_root / f"{split}.jsonl"
        if not manifest.is_file():
            raise FileNotFoundError(f"tool episode generation requires {manifest}")
        rows = [
            row
            for index in range(counts[split])
            for row in _episode_records(split, index)
        ]
        added[split] = _atomic_append(manifest, rows, split)
        hashes[split] = _sha256(manifest)

    report = {
        "version": TOOL_EPISODE_VERSION,
        "status": "generated" if any(added.values()) else "already-present",
        "episodes_requested": counts,
        "records_requested": {split: count * 2 for split, count in counts.items()},
        "records_added": added,
        "manifest_sha256": hashes,
        "execution_verification": "safe_tool_runtime_replay_v1",
        "split_policy": "non-overlapping deterministic price ranges and split-specific seeds",
        "promotion_eligible": False,
    }
    report_path = data_root / "tool-episodes-report.json"
    fd, temp_name = tempfile.mkstemp(prefix=".tool-episodes-report-", dir=data_root)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, report_path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise
    return report
