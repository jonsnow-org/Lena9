from pathlib import Path
import json
import yaml

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
    assert request["tokenizer_run_id"] == 45336933362
    assert request["tokenizer_artifact_id"] == 14894835517
    assert request["tokenizer_artifact_name"] == "onecore-v3-tokenizer-45325008221"
    assert request["tokenizer_artifact_digest"] == "sha256:47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6"
    assert request["tokenizer_file_name"] == "onecore-tokenizer-text32000-adopted-20261128.json"
    assert request["tokenizer_sha256"] == "569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76"
    assert request["tokenizer_vocab_size"] == 32000 and request["tokenizer_external_train_text_records"] == 591525
    assert request["tokenizer_validation_or_test_rows_used"] == 0 and request["v2_tokenizer_imported"] is False
    assert "&& false" in workflow



def test_training_workflow_uses_only_the_pinned_corrected_tokenizer_artifact():
    request = json.loads((PROJECT / "v3-training-request.json").read_text(encoding="utf-8"))
    workflow = (WORKFLOWS / "onecore-v3-training.yml").read_text(encoding="utf-8")
    assert request["tokenizer_run_id"] == 45336933362
    assert request["tokenizer_source_head_sha"] == "065daaa646a9b8ba1a3908476202bb4acddecd5c"
    assert request["tokenizer_artifact_id"] == 14894835517
    assert request["tokenizer_artifact_size_bytes"] == 394036
    assert request["tokenizer_vocab_size"] == 32000
    assert request["tokenizer_train_manifest_sha256"] == "d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205"
    assert request["tokenizer_external_text_rows_sha256"] == "6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720"
    assert "steps.request.outputs.tokenizer_artifact_name" in workflow
    assert "steps.request.outputs.tokenizer_run_id" in workflow
    assert "actions/runs/" in workflow and "tokenizer_artifact_digest" in workflow
    assert "verify_v3_tokenizer(" in workflow
    assert "adopt_v3_tokenizer" in workflow and "onecore-v3-tokenizer-run605-vocab32000.json" in workflow
    assert "&& false" in workflow

def test_tokenizer_workflow_is_pinned_idempotent_and_does_not_train():
    request = json.loads((PROJECT / "v3-tokenizer-request.json").read_text(encoding="utf-8"))
    workflow = (WORKFLOWS / "onecore-v3-tokenizer.yml").read_text(encoding="utf-8")
    assert request["source_run_id"] == 45336933362
    assert request["source_artifact_id"] == 14894835517
    assert request["source_artifact_name"] == "onecore-v3-tokenizer-45325008221"
    assert request["source_artifact_digest"] == "sha256:47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6"
    assert request["source_evidence_sha256"] == "b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16"
    assert request["external_train_text_records"] == 591525
    assert request["architecture_version"] == "onecore-v3-corrected-spec-3"
    assert request["output_artifact_name"] == "onecore-v3-tokenizer-32000-adopted-45336933362"
    assert request["tokenizer_file_name"] == "onecore-tokenizer-text32000-adopted-20261128.json"
    assert request["refit_performed"] is False and request["tokenizer_bytes_modified"] is False
    assert request["train_manifest_sha256"] == "d499968cdd5e1869ae7b5d9866261e8aad8fe091ad9096b13067bfb6a83f9205"
    assert request["external_text_rows_sha256"] == "6d60d6a07fbd82932373c449735d1b73cd882bcd14390e07a60400c2cc97e720"
    config = yaml.safe_load((PROJECT / "configs/onecore-v3-research.yaml").read_text(encoding="utf-8"))
    assert config["architecture_version"] == request["architecture_version"]
    assert config["model"]["text_vocab_size"] == 32000
    assert sum(config["model"][key] for key in ("text_vocab_size", "vision_codebook_size", "audio_codebook_size", "motion_codebook_size", "special_tokens")) == 33048
    assert "onecore-v3-tokenizer-run605-vocab32000.json" in workflow
    assert "adopt_v3_tokenizer" in workflow
    assert "external_train_text_records" in workflow and "validation_or_test_rows_used" in workflow
    assert "workflow_dispatch:" in workflow and "cancel-in-progress: false" in workflow
    assert "onecore.v3.tokenizer" in workflow
    assert "source_artifact_digest" in workflow and "source_evidence_sha256" in workflow
    assert "archive_sha" in workflow
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

def test_32k_tokenizer_adoption_pins_hashes_and_preserves_the_original_tokenizer():
    request = json.loads((PROJECT / "v3-tokenizer-request.json").read_text(encoding="utf-8"))
    workflow = (WORKFLOWS / "onecore-v3-tokenizer.yml").read_text(encoding="utf-8")
    assert request["source_artifact_id"] == 14894835517
    assert request["source_artifact_digest"] == "sha256:47246c85500ed2647aacfd00187dacf4dedae1f10b180910ff55f71463851bd6"
    assert request["source_tokenizer_sha256"] == "569f1b61e017dcf5c8ba9fef22a8002cc48d5ea3c26504bdae83f53834d00e76"
    assert request["source_evidence_sha256"] == "b60e5077767f79b1316635ed45343ed5c59ce2602f41d24759a25a386ea33e16"
    assert request["external_train_text_records"] == 591525
    assert request["validation_or_test_rows_used"] == 0
    assert request["refit_performed"] is False and request["tokenizer_bytes_modified"] is False
    assert "adopt_v3_tokenizer" in workflow and "archive_sha" in workflow
    assert "tokenizer_bytes_modified" in workflow and "refit_performed" in workflow


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

def test_source_cursor_is_pipeline_scoped_not_notebook_scoped():
    registry = yaml.safe_load((PROJECT / "data/sources.yaml").read_text(encoding="utf-8"))
    sources = registry.get("sources") or []
    assert sources and all("notebook_id" not in source for source in sources if isinstance(source, dict))
    cursor = (PROJECT / "src/onecore/crawlers.py").read_text(encoding="utf-8")
    assert "class StatefulStreamCursor" in cursor
    assert "pipeline_id: str" in cursor
    assert '"pipeline_id": self.pipeline_id' in cursor
    assert 'payload.get("pipeline_id", payload.get("notebook_id"))' in cursor
    assert "def notebook_for_source" not in cursor
    assert "def notebook_cursor_summary" not in cursor
    assert "def source_ids_for_notebook" not in cursor

def test_corpus_restore_uses_the_pinned_source_snapshot_not_a_historical_model_revision():
    workflow = (WORKFLOWS / "onecore-ci.yml").read_text(encoding="utf-8")
    snapshot = PROJECT / "data/corpus-source-snapshot-45325008221.yaml"
    assert snapshot.is_file()
    assert "git fetch --no-tags" not in workflow
    assert "5489900c3662082ad39efbfac5b6a2c7d22a7c4c" not in workflow
    assert 'cp onecore-ai/data/corpus-source-snapshot-45325008221.yaml "$RUNNER_TEMP/onecore-sources.yaml"' in workflow
    pinned = yaml.safe_load(snapshot.read_text(encoding="utf-8"))
    active = yaml.safe_load((PROJECT / "data/sources.yaml").read_text(encoding="utf-8"))
    assert len(pinned.get("sources") or []) >= len(active.get("sources") or [])
