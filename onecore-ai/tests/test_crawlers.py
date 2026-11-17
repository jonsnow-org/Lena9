import gzip
import io

from onecore.crawlers import (
    StatefulStreamCursor,
    cursor_checkpoint_due,
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


def test_notebook_assignment_and_checkpoint_interval():
    assert notebook_for_source({"adapter": "text"}) == "03_text_pretraining"
    assert notebook_for_source({"adapter": "stack_v2_code"}) == "03_text_pretraining"
    assert notebook_for_source({"adapter": "image"}) == "04_multimodal_curriculum"
    assert cursor_checkpoint_due(64, 64)
    assert not cursor_checkpoint_due(63, 64)


def test_stack_v2_license_allowlist_and_streaming_swh_content():
    assert has_allowed_stack_license({"detected_licenses": ["MIT", "Apache-2.0"]})
    assert not has_allowed_stack_license({"detected_licenses": ["GPL-3.0-only"]})
    assert not has_allowed_stack_license({"detected_licenses": []})

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
