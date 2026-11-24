from __future__ import annotations

import hashlib
import json
from typing import Any, Callable

from .curriculum_reference import canonical_json


ELIGIBLE_TOOL_REFERENCES = {
    "tool.calculator.v1",
    "tool.text_count.v1",
    "tool.discount_workflow_step.v1",
}


def evaluate_tool_behavior(
    records: list[dict[str, Any]],
    generate_tool_call: Callable[[dict[str, Any]], dict[str, Any]],
    max_examples: int = 32,
) -> dict[str, Any]:
    """Score generated tool calls by executing them against verified held-out tasks.

    Sampling is deterministic and stratified by workflow step, so a two-step
    trajectory cannot score well by succeeding only at its first action.
    """
    if max_examples < 1:
        raise ValueError("max_examples must be positive")

    eligible = [
        record for record in records
        if record.get("task") == "tool_use"
        and record.get("verification", {}).get("method") == "deterministic_reference_solver_v1"
        and record.get("verification", {}).get("reference") in ELIGIBLE_TOOL_REFERENCES
        and isinstance(record.get("prompt"), str)
        and isinstance(record.get("response"), str)
        and isinstance(record.get("expected_tool_result"), dict)
    ]
    for record in eligible:
        try:
            expected = json.loads(record["response"])
        except json.JSONDecodeError as exc:
            raise ValueError(f"verified tool record has invalid expected JSON: {record.get('id')}") from exc
        if not isinstance(expected, dict):
            raise ValueError(f"verified tool record has a non-object expected call: {record.get('id')}")

    by_step: dict[str, list[dict[str, Any]]] = {}
    for record in eligible:
        step = str(record.get("episode_step_index", "single"))
        by_step.setdefault(step, []).append(record)
    for values in by_step.values():
        values.sort(key=lambda row: hashlib.sha256(str(row.get("id", "")).encode("utf-8")).hexdigest())

    ordered_steps = sorted(by_step, key=lambda value: (value == "single", value))
    selected: list[dict[str, Any]] = []
    quotas = {step: max_examples // max(1, len(ordered_steps)) for step in ordered_steps}
    for step in ordered_steps:
        selected.extend(by_step[step][:quotas[step]])
    remainder = max_examples - len(selected)
    if remainder:
        leftovers = [
            row for step in ordered_steps for row in by_step[step][quotas[step]:]
        ]
        leftovers.sort(key=lambda row: hashlib.sha256(str(row.get("id", "")).encode("utf-8")).hexdigest())
        selected.extend(leftovers[:remainder])
    selected = selected[:max_examples]

    valid_payloads = 0
    allowlisted_dispatches = 0
    execution_matches = 0
    exact_payload_matches = 0
    error_types: dict[str, int] = {}
    step_stats: dict[str, dict[str, int]] = {}

    for record in selected:
        step = str(record.get("episode_step_index", "single"))
        stats = step_stats.setdefault(step, {
            "sample_count": 0,
            "valid_payload_count": 0,
            "allowlisted_dispatch_count": 0,
            "execution_match_count": 0,
            "exact_payload_match_count": 0,
        })
        stats["sample_count"] += 1
        try:
            generated = generate_tool_call(record)
        except Exception as exc:
            name = type(exc).__name__
            error_types[name] = error_types.get(name, 0) + 1
            continue

        if not isinstance(generated, dict) or not isinstance(generated.get("payload"), str):
            error_types["MalformedGeneratorOutput"] = error_types.get("MalformedGeneratorOutput", 0) + 1
            continue
        try:
            predicted_payload = json.loads(generated["payload"])
        except json.JSONDecodeError:
            error_types["InvalidJSON"] = error_types.get("InvalidJSON", 0) + 1
            continue
        if not isinstance(predicted_payload, dict):
            error_types["NonObjectJSON"] = error_types.get("NonObjectJSON", 0) + 1
            continue
        valid_payloads += 1
        stats["valid_payload_count"] += 1

        expected_payload = json.loads(record["response"])
        if canonical_json(predicted_payload) == canonical_json(expected_payload):
            exact_payload_matches += 1
            stats["exact_payload_match_count"] += 1

        execution = generated.get("execution")
        if not isinstance(execution, dict) or execution.get("ok") is not True:
            error_types["ToolDispatchRejected"] = error_types.get("ToolDispatchRejected", 0) + 1
            continue
        allowlisted_dispatches += 1
        stats["allowlisted_dispatch_count"] += 1
        if canonical_json(execution) == canonical_json(record["expected_tool_result"]):
            execution_matches += 1
            stats["execution_match_count"] += 1

    def rate(numerator: int, denominator: int) -> float | None:
        return round(numerator / denominator, 6) if denominator else None

    per_step: dict[str, dict[str, Any]] = {}
    for step, stats in step_stats.items():
        count = stats["sample_count"]
        per_step[step] = stats | {
            "execution_success_rate": rate(stats["execution_match_count"], count),
            "allowlisted_dispatch_rate": rate(stats["allowlisted_dispatch_count"], count),
        }

    sample_ids = [str(record.get("id", "")) for record in selected]
    return {
        "protocol": "verified-tool-action-execution-v1",
        "eligible_records": len(eligible),
        "sample_count": len(selected),
        "valid_payload_count": valid_payloads,
        "valid_payload_rate": rate(valid_payloads, len(selected)),
        "allowlisted_dispatch_count": allowlisted_dispatches,
        "allowlisted_dispatch_rate": rate(allowlisted_dispatches, len(selected)),
        "execution_match_count": execution_matches,
        "execution_success_rate": rate(execution_matches, len(selected)),
        "exact_payload_match_count": exact_payload_matches,
        "exact_payload_match_rate": rate(exact_payload_matches, len(selected)),
        "per_step": per_step,
        "error_types": error_types,
        "sample_ids_sha256": hashlib.sha256(
            canonical_json(sorted(sample_ids)).encode("utf-8")
        ).hexdigest(),
    }
