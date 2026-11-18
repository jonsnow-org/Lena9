import gzip
import io

from onecore.crawlers import (
    StatefulStreamCursor,
    notebook_cursor_summary,
    notebook_for_source,
)
from onecore.stack_v2 import fetch_stack_content, has_allowed_stack_license


class FakeIterable:
    def __init__(self, values):
        self.values = list(values)
        self.position = 0

    def __iter__(self):
        while self.position < len(self.values):
            value = self.values[self.position]
            self.position += 1
            yield value

    def state_dict(self):
        return {"position": self.position}

    def load_state_dict(self, state):
        self.position = int(state["position"])

    def skip(self, count):
        self.position = min(int(count), len(self.values))
        return self


def test_stateful_cursor_resumes_exact_position_and_is_atomic(tmp_path):
    cursor = StatefulStreamCursor(
        tmp_path, "03_text_pretraining", "fineweb_ar", "HuggingFaceFW/fineweb-2",
        "arb_Arab", "train", "a" * 40,
    )
    stream, offset, mode = cursor.restore(FakeIterable(range(10)))
    assert (offset, mode) == (0, "fresh")
    iterator = iter(stream)
    assert [next(iterator), next(iterator), next(iterator)] == [0, 1, 2]
    saved = cursor.save(stream, 3)
    assert saved["cursor_mode"] == "state_dict"
    assert saved["rows_read"] == 3
    assert cursor.path.is_file()
    assert not cursor.path.with_suffix(".json.tmp").exists()

    resumed, offset, mode = cursor.restore(FakeIterable(range(10)))
    assert (offset, mode) == (3, "state_dict")
    assert list(resumed) == list(range(3, 10))


def test_notebook_cursors_are_isolated_and_reported_independently(tmp_path):
    text_cursor = StatefulStreamCursor(
        tmp_path, "03_text_pretraining", "stack_v2_code", "bigcode/the-stack-v2",
        None, "train", "b" * 40,
    )
    media_cursor = StatefulStreamCursor(
        tmp_path, "04_multimodal_curriculum", "fleurs_ar", "google/fleurs",
        "ar_eg", "train", "c" * 40,
    )
    assert text_cursor.path != media_cursor.path
    text_cursor.save(FakeIterable([1, 2]), 7)
    media_cursor.save(FakeIterable([1, 2]), 11)

    text_summary = notebook_cursor_summary(tmp_path, "03_text_pretraining")
    media_summary = notebook_cursor_summary(tmp_path, "04_multimodal_curriculum")
    assert text_summary["cursor_files"] == 1
    assert text_summary["sources"]["stack_v2_code"]["train"] == 7
    assert media_summary["cursor_files"] == 1
    assert media_summary["sources"]["fleurs_ar"]["train"] == 11


def test_cursor_resets_when_source_revision_changes(tmp_path):
    cursor = StatefulStreamCursor(
        tmp_path, "03_text_pretraining", "fineweb_ar", "HuggingFaceFW/fineweb-2",
        "arb_Arab", "train", "d" * 40,
    )
    cursor.save(FakeIterable(range(5)), 5)

    changed = StatefulStreamCursor(
        tmp_path, "03_text_pretraining", "fineweb_ar", "HuggingFaceFW/fineweb-2",
        "arb_Arab", "train", "e" * 40,
    )
    stream, offset, mode = changed.restore(FakeIterable(range(5)), legacy_offset=0)
    assert (offset, mode) == (0, "fresh")
    assert list(stream) == list(range(5))


def test_notebook_assignment_for_each_data_family():
    assert notebook_for_source({"adapter": "text"}) == "03_text_pretraining"
    assert notebook_for_source({"adapter": "tool_use"}) == "03_text_pretraining"
    assert notebook_for_source({"adapter": "stack_v2_code"}) == "03_text_pretraining"
    assert notebook_for_source({"adapter": "image"}) == "04_multimodal_curriculum"
    assert notebook_for_source({"adapter": "audio"}) == "04_multimodal_curriculum"
    assert notebook_for_source({"adapter": "video"}) == "04_multimodal_curriculum"


def test_stack_v2_license_allowlist_and_streaming_swh_content():
    assert has_allowed_stack_license({"detected_licenses": ["MIT", "Apache-2.0"]})
    assert has_allowed_stack_license({"detected_licenses": [], "gha_license_id": "MIT"})
    assert not has_allowed_stack_license({"detected_licenses": ["GPL-3.0-only"]})
    assert not has_allowed_stack_license({"detected_licenses": [], "gha_license_id": "GPL-3.0-only"})
    assert not has_allowed_stack_license({"detected_licenses": [], "gha_license_id": ""})

    code = b"def useful_function(value):\n    return value + 1\n"
    class Body(io.BytesIO):
        pass

    class FakeS3:
        def get_object(self, *, Bucket, Key):
            assert Bucket == "softwareheritage"
            assert Key == "content/" + "f" * 40
            return {"Body": Body(gzip.compress(code))}

    row = {"blob_id": "f" * 40, "src_encoding": "utf-8"}
    assert fetch_stack_content(row, client=FakeS3()) == code.decode("utf-8")


def test_fineweb2_and_stack_v2_are_real_streaming_sources_with_notebook_ownership():
    import yaml
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    registry = yaml.safe_load((root / "data" / "sources.yaml").read_text(encoding="utf-8"))
    sources = {item["id"]: item for item in registry["sources"]}

    fineweb = sources["fineweb2_full_ar"]
    assert fineweb["repo"] == "HuggingFaceFW/fineweb-2"
    assert fineweb["config"] == "arb_Arab"
    assert fineweb["crawler"] == "hf_state_dict"
    assert fineweb["notebook_id"] == "03_text_pretraining"
    assert fineweb["required_for_training"] is True
    assert fineweb["profile_limits"]["expanded"]["train"] >= 100_000

    stack = sources["stack_v2_code"]
    assert stack["repo"] == "bigcode/the-stack-v2"
    assert stack["adapter"] == "stack_v2_code"
    assert stack["crawler"] == "hf_state_dict_plus_swh_content"
    assert stack["notebook_id"] == "03_text_pretraining"
    assert stack["required_for_training"] is False
    assert stack["minimum_accepted_records"] >= 10_000
    assert "MIT" in stack["license_allowlist"]
    assert "GPL-3.0-only" not in stack["license_allowlist"]
    assert stack["split_group_field"] == "directory_id"
    assert stack["max_content_bytes"] <= 1_048_576

    assert sources["fineweb2_full_tr"]["config"] == "tur_Latn"
    assert sources["fineweb2_full_fr"]["config"] == "fra_Latn"
    assert sources["fineweb2_full_ja"]["config"] == "jpn_Jpan"
    assert sources["fineweb2_full_en"]["enabled"] is False


def test_stack_credentials_are_required_before_declaring_stack_access(monkeypatch):
    from onecore.stack_v2 import stack_credentials_present

    monkeypatch.delenv("STACK_V2_AWS_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("STACK_V2_AWS_SECRET_ACCESS_KEY", raising=False)
    monkeypatch.delenv("AWS_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("AWS_SECRET_ACCESS_KEY", raising=False)
    assert stack_credentials_present() is False

    monkeypatch.setenv("STACK_V2_AWS_ACCESS_KEY_ID", "test-access")
    monkeypatch.setenv("STACK_V2_AWS_SECRET_ACCESS_KEY", "test-secret")
    assert stack_credentials_present() is True


def test_required_source_minimums_and_crawler_credentials_are_wired_into_each_session():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    action = (root.parent / ".github" / "actions" / "onecore-acquire" / "action.yml").read_text(encoding="utf-8")
    workflow = (root.parent / ".github" / "workflows" / "onecore-bootstrap.yml").read_text(encoding="utf-8")
    for key in (
        "stack_v2_aws_access_key_id",
        "stack_v2_aws_secret_access_key",
        "STACK_V2_AWS_ACCESS_KEY_ID",
        "STACK_V2_AWS_SECRET_ACCESS_KEY",
    ):
        assert key in action or key in workflow
    assert workflow.count("secrets.STACK_V2_AWS_ACCESS_KEY_ID") == 6
    assert workflow.count("secrets.STACK_V2_AWS_SECRET_ACCESS_KEY") == 6
    assert "Publish per-notebook crawler progress" in action
    assert "Execute one bounded acquisition session in each owning notebook" in action
    assert "ONECORE_ACQUIRE_ONLY=1" in action
    assert "ONECORE_ACQUIRE_SOURCE_BUDGET_SECONDS" in action
    assert "source_budget_seconds:" in action
    assert 'default: "60"' in action
    assert "source_budget_seconds must be between 60 and 120" in action
    assert "onecore-ai/notebooks/03_text_pretraining.ipynb" in action
    assert "onecore-ai/notebooks/04_multimodal_curriculum.ipynb" in action
    assert "ONECORE_SKIP_ACQUISITION=1" in action
    ci = (root.parent / ".github" / "workflows" / "onecore-ci.yml").read_text(encoding="utf-8")
    assert "os._exit(0)" in ci
    acquire_source = (root / "src" / "onecore" / "acquire.py").read_text(encoding="utf-8")
    assert "source_budget_seconds" in acquire_source
    assert "source_deadline" in acquire_source
    assert "registry_sources.sort(key=lambda item: not bool(item.get(\"required_for_training\")))" in acquire_source
    assert "cursor_snapshots.append" in acquire_source
    assert "saved_cursor = cursor.save(dataset, rows_read)" in acquire_source
    assert "and not split_had_error" in acquire_source
    assert "\"mode\": \"previous_checkpoint_preserved\"" in acquire_source
    assert acquire_source.index("added_counts = _append_manifests(root, rows_by_split)") < acquire_source.index("saved_cursor = cursor.save(dataset, rows_read)")


def test_stack_v2_filters_before_fetching_swh_blobs(tmp_path, monkeypatch):
    from onecore import acquire

    calls = []
    monkeypatch.setattr(
        acquire,
        "fetch_stack_content",
        lambda row, max_bytes=524_288: calls.append(row["blob_id"]) or "def safe_code():\n    return 1\n",
    )
    source = {
        "id": "stack_v2_python",
        "repo": "bigcode/the-stack-v2",
        "adapter": "stack_v2_code",
        "license_allowlist": ["MIT", "Apache-2.0"],
        "allowed_languages": ["Python"],
        "_resolved_revision": "a" * 40,
    }
    base = {
        "blob_id": "f" * 40,
        "src_encoding": "utf-8",
        "language": "Python",
        "path": "src/example.py",
        "detected_licenses": ["MIT"],
        "gha_license_id": "MIT",
        "license_type": "permissive",
        "is_vendor": False,
        "is_generated": False,
        "repo_name": "alice/example-project",
        "directory_id": "d" * 40,
        "revision_id": "r" * 40,
        "snapshot_id": "s" * 40,
        "content_id": "c" * 40,
    }
    assets = tmp_path / "assets"
    good = acquire._record_from_row(dict(base), dict(source), "good-row", "train", assets)
    assert good is not None and good["task"] == "text"
    assert good["code_blob_id"] == "f" * 40
    assert good["code_repository"] == "alice/example-project"
    assert good["code_repository_url"] == "https://github.com/alice/example-project"
    assert good["code_revision_id"] == "r" * 40
    assert good["code_license_type"] == "permissive"
    assert calls == ["f" * 40]

    for changes in (
        {"license_type": "no_license"},
        {"detected_licenses": ["GPL-3.0-only"]},
        {"is_vendor": True},
        {"is_generated": True},
        {"language": "Brainfuck"},
    ):
        row = dict(base)
        row.update(changes)
        assert acquire._record_from_row(row, dict(source), "rejected-row", "train", assets) is None
    assert calls == ["f" * 40], "rejected files must not trigger Software Heritage content requests"


def test_source_registry_routes_text_code_and_multimodal_crawlers_to_their_own_notebooks():
    from pathlib import Path
    from onecore.crawlers import source_ids_for_notebook

    root = Path(__file__).resolve().parents[1]
    text_sources = source_ids_for_notebook(root, "03_text_pretraining")
    media_sources = source_ids_for_notebook(root, "04_multimodal_curriculum")
    assert "fineweb2_full_ar" in text_sources
    assert "stack_v2_code" in text_sources
    assert "fleurs_ar" in media_sources
    assert "openimages_finedet_v1" in media_sources
    assert set(text_sources).isdisjoint(media_sources)
    assert source_ids_for_notebook(root, "not-a-notebook") == []


def test_stack_v2_rejects_exposed_secrets_and_redacts_email_addresses():
    from onecore.stack_v2 import contains_exposed_secret, redact_personal_contacts

    assert contains_exposed_secret("-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----")
    assert contains_exposed_secret("AWS_ACCESS_KEY_ID=AKIA" + "1234567890ABCDEF")
    assert contains_exposed_secret('api_key = "sk' + "_live_" + "1234567890abcdefghijklmnop" + '"')
    assert contains_exposed_secret("ordinary code", ".env.production")
    assert contains_exposed_secret("ordinary code", "config/credentials")
    assert not contains_exposed_secret('api_key = "YOUR_API_KEY_PLACEHOLDER"')
    assert not contains_exposed_secret("password = '<YOUR_PASSWORD>'")
    source = 'contact = "maintainer@example.com"\nprint("safe example")'
    sanitized = redact_personal_contacts(source)
    assert "maintainer@example.com" not in sanitized
    assert "[REDACTED_EMAIL]" in sanitized


def test_large_legacy_offset_replays_from_start_instead_of_unbounded_skip(tmp_path):
    cursor = StatefulStreamCursor(
        tmp_path, "03_text_pretraining", "fineweb_ar", "HuggingFaceFW/fineweb-2",
        "arb_Arab", "train", "f" * 40,
    )
    stream, offset, mode = cursor.restore(FakeIterable(range(10)), legacy_offset=50_000)
    assert (offset, mode) == (0, "legacy_replay_from_start")
    assert list(stream) == list(range(10))
