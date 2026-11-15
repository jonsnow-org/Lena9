from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .checkpoint import write_json_atomic
from .evaluate import promotion_gate


def promote_candidate(metrics_path: str | Path, registry_path: str | Path) -> dict[str, Any]:
    metrics_file = Path(metrics_path)
    if not metrics_file.is_file():
        raise FileNotFoundError(f"evaluation report not found: {metrics_file}")
    metrics = json.loads(metrics_file.read_text(encoding="utf-8"))
    passed, failures = promotion_gate(metrics, require_real_data=True)
    if not passed:
        raise RuntimeError("candidate promotion blocked:\n- " + "\n- ".join(failures))
    registry_file = Path(registry_path)
    registry = json.loads(registry_file.read_text(encoding="utf-8")) if registry_file.exists() else {
        "schema": "onecore-model-registry-v1", "candidates": []
    }
    registry["candidates"].append({
        "checkpoint_sha256": metrics["checkpoint_sha256"],
        "parameter_count": metrics["parameter_count"],
        "text_loss": metrics["text_loss"],
        "modalities_tested": metrics["modalities_tested"],
        "evaluation_id": metrics.get("evaluation_id"),
        "status": "promoted",
    })
    write_json_atomic(registry_file, registry)
    return {"promoted": True, "registry": str(registry_file), "candidate_count": len(registry["candidates"])}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metrics", default="run-state/evaluation.json")
    parser.add_argument("--registry", default="run-state/model-registry.json")
    args = parser.parse_args()
    print(json.dumps(promote_candidate(args.metrics, args.registry), indent=2))


if __name__ == "__main__":
    main()
