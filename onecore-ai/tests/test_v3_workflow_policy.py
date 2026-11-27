from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "onecore-ai"
WORKFLOWS = ROOT / ".github" / "workflows"

def test_onecore_has_one_canonical_model_and_no_parallel_legacy_model():
    assert (PROJECT / "src/onecore/v3/core.py").is_file()
    assert (PROJECT / "src/onecore/v3/runner.py").is_file()
    assert not (PROJECT / "src/onecore/model.py").exists()
    assert not (PROJECT / "src/onecore/train.py").exists()
    assert not (PROJECT / "src/onecore/training_loop.py").exists()
    assert not (PROJECT / "src/onecore/checkpoint.py").exists()
    assert not (PROJECT / "notebooks").exists()
    assert not (WORKFLOWS / "onecore-training.yml").exists()
    assert not (WORKFLOWS / "onecore-bootstrap.yml").exists()
    assert not (ROOT / ".github/actions/onecore-train/action.yml").exists()
    assert not (ROOT / ".github/actions/onecore-acquire/action.yml").exists()

def test_canonical_ci_runs_on_the_only_active_branch_and_restore_is_explicit():
    workflow = (WORKFLOWS / "onecore-ci.yml").read_text(encoding="utf-8")
    assert "branches: [research/onecore-v3-implementation]" in workflow
    assert "workflow_dispatch:" in workflow
    assert "restore_v3_corpus:" in workflow and "benchmark_v3_resources:" in workflow
    assert "inputs.restore_v3_corpus == true" in workflow
    assert "inputs.benchmark_v3_resources == true" in workflow
    assert "onecore.v3.resource_benchmark" in workflow

def test_the_only_training_workflow_is_fail_closed_and_includes_native_tldm():
    workflow = (WORKFLOWS / "onecore-v3-training.yml").read_text(encoding="utf-8")
    request = json.loads((PROJECT / "v3-training-request.json").read_text(encoding="utf-8"))
    assert "on:\n  workflow_dispatch:" in workflow
    assert "\n  push:" not in workflow
    assert "&& false" in workflow
    assert "--tldm-diffusion-weight" in workflow
    assert request["tldm_diffusion_weight"] == 0.15
    assert request["steps"] == 5 and request["checkpoint_every"] == 1
    assert request["resume_artifact_run_id"] is None

def test_tokenizer_workflow_is_pinned_idempotent_and_does_not_train():
    request = json.loads((PROJECT / "v3-tokenizer-request.json").read_text(encoding="utf-8"))
    workflow = (WORKFLOWS / "onecore-v3-tokenizer.yml").read_text(encoding="utf-8")
    assert request["source_run_id"] == 45325008221
    assert request["source_artifact_id"] == 14892594659
    assert request["source_artifact_name"] == "onecore-v3-corpus-45325008221"
    assert request["minimum_text_records"] >= 100
    assert request["output_artifact_name"] == "onecore-v3-tokenizer-45325008221"
    assert "workflow_dispatch:" in workflow and "cancel-in-progress: false" in workflow
    assert "onecore.v3.tokenizer" in workflow
    assert "validation_or_test_rows_used" in workflow
    assert "onecore.v3.training" not in workflow and "train_v3_step(" not in workflow

def test_v3_training_requires_a_run_bound_cpu_resource_report():
    runner = (PROJECT / "src/onecore/v3/runner.py").read_text(encoding="utf-8")
    workflow = (WORKFLOWS / "onecore-v3-training.yml").read_text(encoding="utf-8")
    evidence = (PROJECT / "src/onecore/v3/resource_evidence.py").read_text(encoding="utf-8")
    assert 'parser.add_argument("--resource-evidence", required=True)' in runner
    assert "resource_evidence_path=args.resource_evidence" in runner
    assert "_validate_resource_evidence(" in runner
    assert "onecore.v3.resource_evidence" in workflow
    assert 'BENCHMARK_JOB_NAME = "Measure V3 CPU memory and throughput from existing artifacts"' in evidence
    assert "steps.resource-evidence.outputs.artifact_name" in workflow
    assert "resource-evidence-artifact.json" in workflow

def test_every_onecore_agent_reads_the_cross_session_protocol_and_handover():
    agent_rules = (PROJECT / "AGENTS.md").read_text(encoding="utf-8")
    readme = (PROJECT / "README.md").read_text(encoding="utf-8")
    protocol = (PROJECT / "SESSION_PROTOCOL.md").read_text(encoding="utf-8")
    handover = (PROJECT / "docs/EXECUTIVE_HANDOVER.md").read_text(encoding="utf-8")
    lock = json.loads((PROJECT / "SESSION_LOCK.json").read_text(encoding="utf-8"))
    assert "SESSION_PROTOCOL.md" in agent_rules and "SESSION_LOCK.json" in agent_rules
    assert "docs/EXECUTIVE_HANDOVER.md" in agent_rules and "SESSION_PROTOCOL.md" in readme
    assert "latest 20 relevant" in protocol and "compare-and-swap" in protocol
    assert "remain read-only" in protocol
    assert "Mandatory multi-client coordination protocol" in handover
    assert lock["schema_version"] == 1 and lock["status"] in {"active", "released"}
    if lock["status"] == "active":
        assert lock["holder"] and lock["lease_expires_at_utc"]
