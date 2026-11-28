import json

import pytest

from onecore.v3.evaluation_cli import validate_completed_training_result


def _result(sha):
    digest = "a" * 64
    return {
        "status": "completed_segment",
        "architecture_family": "onecore-v3",
        "training_is_actual_optimizer_updates": True,
        "optimizer_step": 3,
        "config_sha256": digest,
        "manifest_sha256": digest,
        "train_manifest_sha256": digest,
        "tokenizer_sha256": digest,
        "resource_evidence_sha256": digest,
        "checkpoint": {"sha256": sha, "global_step": 3},
        "lineage": {"run_id": "123456789", "session": 1, "parent_checkpoint_sha256": "b" * 64},
    }


def test_v3_evaluation_cli_requires_a_completed_nonzero_training_checkpoint(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    checkpoint.write_bytes(b"verified-training-checkpoint")
    import hashlib
    digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    report = _result(digest)

    bound = validate_completed_training_result(
        report, checkpoint, expected_training_run_id="123456789"
    )
    assert bound["global_step"] == 3
    assert bound["checkpoint_sha256"] == digest

    for field, value, pattern in (
        ("status", "training", "completed_segment"),
        ("optimizer_step", 0, "step-zero"),
        ("training_is_actual_optimizer_updates", False, "actual optimizer updates"),
    ):
        bad = dict(report)
        bad[field] = value
        with pytest.raises(ValueError, match=pattern):
            validate_completed_training_result(bad, checkpoint)

    with pytest.raises(ValueError, match="lineage"):
        validate_completed_training_result(
            report, checkpoint, expected_training_run_id="999"
        )


def test_v3_evaluation_cli_rejects_checkpoint_hash_or_manifest_metadata_mismatch(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    checkpoint.write_bytes(b"verified-training-checkpoint")
    import hashlib
    digest = hashlib.sha256(checkpoint.read_bytes()).hexdigest()
    report = _result(digest)

    checkpoint.write_bytes(b"changed-checkpoint")
    with pytest.raises(ValueError, match="SHA-256 differs"):
        validate_completed_training_result(report, checkpoint)

    checkpoint.write_bytes(b"verified-training-checkpoint")
    report = _result(digest)
    report["tokenizer_sha256"] = "bad"
    with pytest.raises(ValueError, match="tokenizer_sha256"):
        validate_completed_training_result(report, checkpoint)
