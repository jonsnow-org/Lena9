from __future__ import annotations

import hashlib
import json
from pathlib import Path

from onecore.license_audit import audit_source_licenses


def _write_inputs(root: Path, *, reviews: str, sources: str | None = None):
    source_yaml = sources or """version: 1
sources:
  - id: dataset_a
    repo: org/dataset-a
    adapter: text
    enabled: true
  - id: dataset_b
    repo: org/dataset-b
    adapter: image
    enabled: true
"""
    (root / "sources.yaml").write_text(source_yaml, encoding="utf-8")
    evidence_dir = root / "evidence"
    evidence_dir.mkdir(exist_ok=True)
    (evidence_dir / "dataset-a-license.txt").write_bytes(_EVIDENCE_BYTES)
    (root / "license-review.yaml").write_text(
        "version: 1\nsources:\n" + reviews, encoding="utf-8"
    )
    return root / "sources.yaml", root / "license-review.yaml"


_EVIDENCE_BYTES = b"captured authoritative dataset license terms\\n"


def _approved_review():
    import hashlib

    digest = hashlib.sha256(_EVIDENCE_BYTES).hexdigest()
    return f"""  dataset_a:
    review_status: approved
    license_expression: CC-BY-4.0
    evidence_url: https://example.org/dataset-a/license
    evidence_file: evidence/dataset-a-license.txt
    evidence_sha256: {digest}
    reviewed_by: legal-reviewer
    reviewed_at: "2026-11-26"
    model_training_use: true
    commercial_deployment_use: true
    weight_redistribution_use: false
    attribution_required: true
    share_alike_or_copyleft: false
"""


def test_default_unknown_sources_are_not_commercially_cleared(tmp_path):
    sources, reviews = _write_inputs(tmp_path, reviews="")
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    assert report["commercial_ready"] is False
    assert report["total_sources"] == 2
    assert report["commercially_approved_sources"] == 0
    assert report["blocked_or_unreviewed_sources"] == 2
    assert all(item["status"] == "unreviewed" for item in report["sources"])


def test_explicit_review_requires_evidence_and_both_permissions(tmp_path):
    sources, reviews = _write_inputs(tmp_path, reviews=_approved_review())
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    assert report["commercial_ready"] is False
    approved = next(item for item in report["sources"] if item["source_id"] == "dataset_a")
    unreviewed = next(item for item in report["sources"] if item["source_id"] == "dataset_b")
    assert approved["commercially_approved"] is True
    assert unreviewed["status"] == "unreviewed"

    blocked_review = _approved_review().replace("model_training_use: true", "model_training_use: false")
    sources, reviews = _write_inputs(tmp_path, reviews=blocked_review)
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    item = next(item for item in report["sources"] if item["source_id"] == "dataset_a")
    assert item["commercially_approved"] is False
    assert "model_training_use is not approved" in item["reasons"]


def test_manifest_scope_audits_only_external_source_ids_and_flags_unregistered(tmp_path):
    sources, reviews = _write_inputs(tmp_path, reviews=_approved_review())
    train = tmp_path / "train.jsonl"
    train.write_text(
        json.dumps({
            "id": "a1", "task": "text", "source_url": "https://example.org/a",
            "split": "train", "data_class": "external", "source_id": "dataset_a",
            "text": "external sample",
        }) + "\n"
        + json.dumps({
            "id": "a2", "task": "text", "source_url": "https://unknown.org/x",
            "split": "train", "data_class": "external", "source_id": "unknown_source",
            "text": "external sample",
        }) + "\n"
        + json.dumps({
            "id": "s1", "task": "text", "source_url": "local://synthetic",
            "split": "train", "data_class": "synthetic", "text": "test fixture",
        }) + "\n",
        encoding="utf-8",
    )
    report = audit_source_licenses(
        sources_path=sources, reviews_path=reviews, manifest_paths=[train]
    )
    assert report["scope"] == "external_source_ids_in_manifests"
    assert report["row_counts_by_source"] == {"dataset_a": 1, "unknown_source": 1}
    assert report["unregistered_source_ids"] == ["unknown_source"]
    assert report["commercial_ready"] is False
    unknown = next(item for item in report["sources"] if item["source_id"] == "unknown_source")
    assert unknown["status"] == "unregistered_source"


def test_approved_review_with_malformed_evidence_hash_is_invalid(tmp_path):
    valid_review = _approved_review()
    valid_digest = hashlib.sha256(_EVIDENCE_BYTES).hexdigest()
    bad = valid_review.replace(
        f"evidence_sha256: {valid_digest}",
        "evidence_sha256: missing",
    )
    assert bad != valid_review
    sources, reviews = _write_inputs(tmp_path, reviews=bad)
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    item = next(item for item in report["sources"] if item["source_id"] == "dataset_a")
    assert item["status"] == "invalid"
    assert item["commercially_approved"] is False
    assert "evidence_sha256 must be a 64-character lowercase SHA-256" in item["reasons"]


def test_orphan_license_review_entry_never_clears_a_source(tmp_path):
    source_yaml = """version: 1
sources:
  - id: dataset_a
    repo: org/dataset-a
    adapter: text
    enabled: true
"""
    orphan = """  deleted_dataset:
    review_status: approved
    license_expression: MIT
    evidence_url: https://example.org/license
    evidence_sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    reviewed_by: reviewer
    reviewed_at: "2026-11-26"
    model_training_use: true
    commercial_deployment_use: true
    weight_redistribution_use: true
"""
    sources, reviews = _write_inputs(tmp_path, reviews=orphan, sources=source_yaml)
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    assert report["commercial_ready"] is False
    assert any(item["status"] == "orphan_review_entry" for item in report["sources"])



def test_enabled_sources_default_to_enabled_when_registry_omits_flag(tmp_path):
    source_yaml = """version: 1
sources:
  - id: implicit_enabled
    repo: org/implicit
    adapter: text
"""
    sources, reviews = _write_inputs(tmp_path, reviews="", sources=source_yaml)
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    assert report["total_sources"] == 1
    assert report["sources"][0]["source_id"] == "implicit_enabled"
    assert report["sources"][0]["status"] == "unreviewed"



def test_approved_review_requires_explicit_attribution_and_share_alike_flags(tmp_path):
    bad = _approved_review().replace(
        "    attribution_required: true\n", ""
    ).replace("    share_alike_or_copyleft: false\n", "")
    sources, reviews = _write_inputs(tmp_path, reviews=bad)
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    item = next(row for row in report["sources"] if row["source_id"] == "dataset_a")
    assert item["commercially_approved"] is False
    assert "attribution_required must be an explicit boolean" in item["reasons"]
    assert "share_alike_or_copyleft must be an explicit boolean" in item["reasons"]


def test_current_repository_registry_is_not_commercially_cleared_by_default():
    project = Path(__file__).resolve().parents[1]
    report = audit_source_licenses(
        sources_path=project / "data" / "sources.yaml",
        reviews_path=project / "data" / "license-review.yaml",
    )
    assert report["commercial_ready"] is False
    assert report["total_sources"] > 0
    assert report["commercially_approved_sources"] == 0
    assert report["blocked_or_unreviewed_sources"] == report["total_sources"]



def test_approved_review_requires_retained_evidence_file_and_matching_hash(tmp_path):
    review = _approved_review().replace(
        "evidence_file: evidence/dataset-a-license.txt",
        "evidence_file: evidence/missing-license.txt",
    )
    sources, reviews = _write_inputs(tmp_path, reviews=review)
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    item = next(row for row in report["sources"] if row["source_id"] == "dataset_a")
    assert item["status"] == "invalid"
    assert "evidence_file does not exist" in item["reasons"]

    review = _approved_review().replace(
        _EVIDENCE_BYTES.decode().strip(), "different retained evidence"
    )
    sources, reviews = _write_inputs(tmp_path, reviews=review)
    (tmp_path / "evidence" / "dataset-a-license.txt").write_text(
        "different retained evidence", encoding="utf-8"
    )
    report = audit_source_licenses(sources_path=sources, reviews_path=reviews)
    item = next(row for row in report["sources"] if row["source_id"] == "dataset_a")
    assert item["status"] == "invalid"
    assert "evidence_sha256 does not match the retained evidence_file bytes" in item["reasons"]
