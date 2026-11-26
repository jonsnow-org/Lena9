"""Fail-closed source-license audit for OneCore.

This module does not infer permission from repository names or external hashes.
A human reviewer must record source-specific authoritative license evidence.
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import date
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse
import re

import yaml

from .data import classify_record_data, iter_manifest

_HEX = re.compile(r"^[0-9a-f]{64}$")
_REQUIRED_REVIEW_FLAGS = (
    "model_training_use",
    "commercial_deployment_use",
    "weight_redistribution_use",
    "attribution_required",
    "share_alike_or_copyleft",
)


def _load_yaml(path: str | Path, label: str) -> dict[str, Any]:
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"{label} file not found: {source}")
    try:
        value = yaml.safe_load(source.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ValueError(f"{label} YAML is invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{label} YAML root must be a mapping")
    return value


def _is_https(value: Any) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value.strip())
    return parsed.scheme == "https" and bool(parsed.netloc)


def _validate_review(
    review: Any,
    *,
    evidence_root: Path,
) -> tuple[str, list[str], dict[str, Any] | None]:
    if not isinstance(review, dict):
        return "invalid", ["review entry must be a mapping"], None

    reasons: list[str] = []
    status = str(review.get("review_status", "")).strip().lower()
    if status not in {"approved", "restricted", "pending", "unreviewed"}:
        reasons.append("review_status must be approved, restricted, pending, or unreviewed")

    license_expression = str(review.get("license_expression", "")).strip()
    if not license_expression:
        reasons.append("license_expression is missing")
    evidence_url = review.get("evidence_url")
    if not _is_https(evidence_url):
        reasons.append("evidence_url must be HTTPS")
    evidence_file_value = review.get("evidence_file")
    evidence_file_path: Path | None = None
    if not isinstance(evidence_file_value, str) or not evidence_file_value.strip():
        reasons.append("evidence_file must point to a retained local copy of the reviewed terms")
    else:
        relative_evidence = Path(evidence_file_value)
        if relative_evidence.is_absolute() or ".." in relative_evidence.parts:
            reasons.append("evidence_file must be a confined relative path")
        else:
            candidate = (evidence_root / relative_evidence).resolve()
            try:
                candidate.relative_to(evidence_root.resolve())
            except ValueError:
                reasons.append("evidence_file resolves outside the license evidence directory")
            else:
                if not candidate.is_file():
                    reasons.append("evidence_file does not exist")
                else:
                    evidence_file_path = candidate
    evidence_sha = str(review.get("evidence_sha256", "")).strip().lower()
    if not _HEX.fullmatch(evidence_sha):
        reasons.append("evidence_sha256 must be a 64-character lowercase SHA-256")
    elif evidence_file_path is not None:
        digest = hashlib.sha256()
        with evidence_file_path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != evidence_sha:
            reasons.append("evidence_sha256 does not match the retained evidence_file bytes")
    reviewer = str(review.get("reviewed_by", "")).strip()
    if not reviewer:
        reasons.append("reviewed_by is missing")
    reviewed_at = str(review.get("reviewed_at", "")).strip()
    try:
        date.fromisoformat(reviewed_at)
    except ValueError:
        reasons.append("reviewed_at must be an ISO date")

    flags: dict[str, bool] = {}
    for field in _REQUIRED_REVIEW_FLAGS:
        value = review.get(field)
        if not isinstance(value, bool):
            reasons.append(f"{field} must be an explicit boolean")
        else:
            flags[field] = value

    if status == "restricted":
        reasons.append("source is explicitly marked restricted")
    elif status in {"pending", "unreviewed"}:
        reasons.append(f"source review status is {status}")
    elif status == "approved":
        if flags.get("model_training_use") is not True:
            reasons.append("model_training_use is not approved")
        if flags.get("commercial_deployment_use") is not True:
            reasons.append("commercial_deployment_use is not approved")

    malformed = any(
        "missing" in reason
        or "must be" in reason
        or "must be HTTPS" in reason
        or reason.startswith("evidence_file")
        or reason.startswith("evidence_sha256 does not match")
        for reason in reasons
    )
    classification = (
        "invalid" if malformed and status == "approved"
        else "commercially_approved" if status == "approved" and not reasons
        else "blocked"
    )
    normalized = {
        "review_status": status or "unreviewed",
        "license_expression": license_expression or None,
        "evidence_url": evidence_url if _is_https(evidence_url) else None,
        "evidence_file": str(evidence_file_value).strip() if evidence_file_path else None,
        "evidence_sha256": evidence_sha if _HEX.fullmatch(evidence_sha) else None,
        "reviewed_by": reviewer or None,
        "reviewed_at": reviewed_at or None,
        **flags,
        "review_notes": str(review.get("review_notes", "")).strip() or None,
    }
    return classification, reasons, normalized


def audit_source_licenses(
    *,
    sources_path: str | Path,
    reviews_path: str | Path,
    manifest_paths: Iterable[str | Path] | None = None,
) -> dict[str, Any]:
    """Audit enabled sources or exact external source IDs present in manifests."""
    registry = _load_yaml(sources_path, "source registry")
    review_registry = _load_yaml(reviews_path, "license review")
    if registry.get("version") != 1 or review_registry.get("version") != 1:
        raise ValueError("source registry and license review versions must both be 1")
    source_items = registry.get("sources")
    if not isinstance(source_items, list) or not source_items:
        raise ValueError("source registry must contain a non-empty sources list")

    sources: dict[str, dict[str, Any]] = {}
    for item in source_items:
        if not isinstance(item, dict):
            raise ValueError("source registry entries must be mappings")
        source_id = str(item.get("id", "")).strip()
        if not source_id:
            raise ValueError("source registry contains an empty source id")
        if source_id in sources:
            raise ValueError(f"duplicate source id: {source_id}")
        sources[source_id] = item

    reviews = review_registry.get("sources") or {}
    if not isinstance(reviews, dict):
        raise ValueError("license review 'sources' must be a mapping")

    row_counts: dict[str, int] = {}
    split_counts: dict[str, dict[str, int]] = {}
    unregistered: set[str] = set()
    if manifest_paths is None:
        selected = {
            source_id for source_id, source in sources.items()
            if source.get("enabled", True) is True
        }
        scope = "all_enabled_registry_sources"
    else:
        selected: set[str] = set()
        scope = "external_source_ids_in_manifests"
        for manifest_path in manifest_paths:
            path = Path(manifest_path)
            split = path.stem
            if split not in {"train", "validation", "test"}:
                raise ValueError(f"manifest filename must be train/validation/test.jsonl: {path}")
            counts = split_counts.setdefault(split, {})
            for record in iter_manifest(path):
                if classify_record_data(record) != "external":
                    continue
                source_id = str(record.get("source_id", "")).strip()
                if not source_id:
                    unregistered.add("<missing-source-id>")
                    continue
                selected.add(source_id)
                row_counts[source_id] = row_counts.get(source_id, 0) + 1
                counts[source_id] = counts.get(source_id, 0) + 1
                if source_id not in sources:
                    unregistered.add(source_id)

    results: list[dict[str, Any]] = []
    for source_id in sorted(selected):
        source = sources.get(source_id)
        if source is None:
            results.append({
                "source_id": source_id,
                "repo": None,
                "enabled": None,
                "records": row_counts.get(source_id, 0),
                "status": "unregistered_source",
                "commercially_approved": False,
                "reasons": ["external manifest source is absent from sources.yaml"],
                "review": None,
            })
            continue
        if source_id not in reviews:
            status = "unreviewed"
            reasons = ["no source-specific license review exists"]
            review_value = None
        else:
            status, reasons, review_value = _validate_review(
                reviews[source_id],
                evidence_root=Path(reviews_path).resolve().parent,
            )
        results.append({
            "source_id": source_id,
            "repo": source.get("repo"),
            "adapter": source.get("adapter"),
            "enabled": source.get("enabled") is True,
            "requires_access": source.get("requires_access") is True,
            "records": row_counts.get(source_id, 0),
            "status": status,
            "commercially_approved": status == "commercially_approved",
            "reasons": reasons,
            "review": review_value,
        })

    for orphan in sorted(set(reviews) - set(sources)):
        results.append({
            "source_id": orphan,
            "repo": None,
            "enabled": None,
            "records": 0,
            "status": "orphan_review_entry",
            "commercially_approved": False,
            "reasons": ["license review references a source absent from sources.yaml"],
            "review": reviews[orphan],
        })

    approved = sum(item["commercially_approved"] for item in results)
    blocked = len(results) - approved
    return {
        "format_version": 1,
        "audit_kind": "onecore_source_license_and_commercial_use_audit",
        "scope": scope,
        "commercial_ready": bool(results) and blocked == 0 and not unregistered,
        "total_sources": len(results),
        "commercially_approved_sources": approved,
        "blocked_or_unreviewed_sources": blocked,
        "weight_distribution_ready": (
            bool(results)
            and blocked == 0
            and all(
                item.get("review", {}).get("weight_redistribution_use") is True
                for item in results
            )
        ),
        "unregistered_source_ids": sorted(unregistered),
        "row_counts_by_source": dict(sorted(row_counts.items())),
        "split_counts_by_source": split_counts,
        "policy": {
            "requires_explicit_source_review": True,
            "requires_authoritative_https_evidence": True,
            "requires_evidence_sha256": True,
            "requires_human_reviewer": True,
            "requires_model_training_and_commercial_deployment_permission": True,
            "unknown_means_not_cleared": True,
            "license_terms_are_not_automatically_interpreted": True,
        },
        "sources": results,
        "disclaimer": (
            "Evidence-completeness gate only; not legal advice or automated license "
            "interpretation. Commercial clearance requires human review of authoritative "
            "source-specific terms."
        ),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit OneCore source licenses and commercial-use evidence.")
    parser.add_argument("--sources", default="onecore-ai/data/sources.yaml")
    parser.add_argument("--reviews", default="onecore-ai/data/license-review.yaml")
    parser.add_argument("--manifest", action="append", dest="manifests")
    parser.add_argument("--output")
    parser.add_argument("--require-commercial-clearance", action="store_true")
    args = parser.parse_args(argv)

    result = audit_source_licenses(
        sources_path=args.sources,
        reviews_path=args.reviews,
        manifest_paths=args.manifests,
    )
    serialized = json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2)
    if args.output:
        target = Path(args.output).resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temp_name = tempfile.mkstemp(
            prefix=f".{target.name}.", suffix=".partial", dir=target.parent
        )
        temporary = Path(temp_name)
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                stream.write(serialized + "\n")
                stream.flush()
                os.fsync(stream.fileno())
            temporary.replace(target)
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
    print(serialized)
    return 2 if args.require_commercial_clearance and not result["commercial_ready"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
