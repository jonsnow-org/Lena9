from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Any

CURSOR_SCHEMA = "onecore-stream-cursor-v1"
LEGACY_SKIP_REPLAY_THRESHOLD = 5_000


def notebook_for_source(source: dict[str, Any]) -> str:
    """Keep text/code crawlers separate from media crawlers, like Sham's per-notebook ledgers."""
    explicit = str(source.get("notebook_id") or "").strip()
    if explicit:
        return explicit
    adapter = str(source.get("adapter", "text")).strip().lower()
    if adapter in {"text", "tool_use", "stack_v2_code"}:
        return "03_text_pretraining"
    return "04_multimodal_curriculum"


def _safe_component(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(value)).strip("-.")
    if not value or value in {".", ".."}:
        raise ValueError(f"unsafe crawler cursor path component: {value!r}")
    return value[:100]


def _jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if hasattr(value, "item"):
        try:
            return _jsonable(value.item())
        except Exception:
            pass
    if isinstance(value, bytes):
        return {"__bytes_hex__": value.hex()}
    raise TypeError(f"stream cursor contains non-JSON state: {type(value).__name__}")


class StatefulStreamCursor:
    """Per-notebook/source/split checkpoint for Hugging Face IterableDataset streams.

    HF's state_dict captures the current shard and row position. A raw row offset is
    retained as a compatibility fallback for iterable datasets that do not implement
    state_dict/load_state_dict. Cursor files live under data/resume-cache, so the
    existing OneCore corpus archive carries them between GitHub runner sessions.
    """

    def __init__(
        self,
        project_root: str | Path,
        notebook_id: str,
        source_id: str,
        repo: str,
        config: str | None,
        split: str,
        revision: str,
    ) -> None:
        self.notebook_id = _safe_component(notebook_id)
        self.source_id = _safe_component(source_id)
        self.repo = str(repo)
        self.config = str(config or "")
        self.split = _safe_component(split)
        self.revision = str(revision)
        self.path = (
            Path(project_root).resolve()
            / "data"
            / "resume-cache"
            / "crawlers"
            / self.notebook_id
            / self.source_id
            / f"{self.split}.json"
        )

    def restore(self, dataset: Any, legacy_offset: int = 0) -> tuple[Any, int, str]:
        """Restore the exact saved stream state, or fall back to the previous raw offset."""
        if self.path.is_file():
            try:
                payload = json.loads(self.path.read_text(encoding="utf-8"))
                matches = (
                    payload.get("schema") == CURSOR_SCHEMA
                    and payload.get("notebook_id") == self.notebook_id
                    and payload.get("source_id") == self.source_id
                    and payload.get("repo") == self.repo
                    and str(payload.get("config") or "") == self.config
                    and payload.get("split") == self.split
                    and payload.get("revision") == self.revision
                )
                state = payload.get("state_dict")
                if matches and isinstance(state, dict) and callable(getattr(dataset, "load_state_dict", None)):
                    restored = dataset.load_state_dict(state)
                    if restored is not None and callable(getattr(restored, "__iter__", None)):
                        dataset = restored
                    return dataset, max(0, int(payload.get("rows_read", 0))), "state_dict"
                if matches:
                    legacy_offset = max(legacy_offset, int(payload.get("rows_read", 0)))
            except Exception:
                # A truncated cursor is not trusted. The manifest IDs still deduplicate
                # any small overlap when the last good offset is used.
                pass

        offset = max(0, int(legacy_offset))
        if offset > LEGACY_SKIP_REPLAY_THRESHOLD:
            # A legacy row offset can force the streaming dataset to read tens of
            # thousands of rows before the source budget starts. Replay from the
            # beginning instead; acquisition deduplicates by source_row_id_sha256
            # before payload conversion, then commits a fresh HF state_dict.
            return dataset, 0, "legacy_replay_from_start"
        if offset:
            skip = getattr(dataset, "skip", None)
            if callable(skip):
                dataset = skip(offset)
            else:
                iterator = iter(dataset)
                for _ in range(offset):
                    try:
                        next(iterator)
                    except StopIteration:
                        break
                dataset = iterator
            return dataset, offset, "row_offset"
        return dataset, 0, "fresh"

    def save(self, dataset: Any, rows_read: int) -> dict[str, Any]:
        """Atomically persist the current stream state and absolute raw row count."""
        state_dict = None
        cursor_mode = "row_offset"
        state_method = getattr(dataset, "state_dict", None)
        if callable(state_method):
            try:
                candidate = state_method()
                if isinstance(candidate, dict):
                    state_dict = _jsonable(candidate)
                    cursor_mode = "state_dict"
            except Exception:
                # Some iterable implementations expose the method but cannot
                # serialize their current iterator. The monotonic raw offset remains.
                state_dict = None

        payload = {
            "schema": CURSOR_SCHEMA,
            "notebook_id": self.notebook_id,
            "source_id": self.source_id,
            "repo": self.repo,
            "config": self.config,
            "split": self.split,
            "revision": self.revision,
            "rows_read": max(0, int(rows_read)),
            "cursor_mode": cursor_mode,
            "state_dict": state_dict,
            "updated_at_unix": int(time.time()),
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.path.with_suffix(self.path.suffix + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, sort_keys=True), encoding="utf-8")
        os.replace(temp, self.path)
        return {
            "cursor_mode": cursor_mode,
            "rows_read": payload["rows_read"],
            "cursor_path": str(self.path),
        }


def notebook_cursor_summary(project_root: str | Path, notebook_id: str) -> dict[str, Any]:
    root = Path(project_root).resolve() / "data" / "resume-cache" / "crawlers" / _safe_component(notebook_id)
    files = sorted(root.rglob("*.json")) if root.exists() else []
    sources: dict[str, dict[str, int]] = {}
    for path in files:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            source_id = str(payload.get("source_id", path.parent.name))
            split = str(payload.get("split", path.stem))
            sources.setdefault(source_id, {})[split] = int(payload.get("rows_read", 0))
        except Exception:
            continue
    return {
        "notebook_id": notebook_id,
        "cursor_files": len(files),
        "sources": sources,
    }


def source_ids_for_notebook(project_root: str | Path, notebook_id: str) -> list[str]:
    """Return enabled registry sources owned by one training notebook, in registry order."""
    import yaml

    root = Path(project_root).resolve()
    registry_path = root / "data" / "sources.yaml"
    registry = yaml.safe_load(registry_path.read_text(encoding="utf-8")) or {}
    sources = registry.get("sources") or []
    notebook_id = str(notebook_id)
    return [
        str(source["id"])
        for source in sources
        if isinstance(source, dict)
        and source.get("enabled", True)
        and source.get("id")
        and notebook_for_source(source) == notebook_id
    ]
