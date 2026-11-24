"""V3-native BPE tokenizer training from pinned external train text only."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import urlparse

from tokenizers import Tokenizer, decoders, models, normalizers, pre_tokenizers, trainers

from onecore.data import external_record_is_trainable, has_immutable_external_provenance

from .config import V3Config
from .manifest import read_v3_manifest

FORMAT_VERSION = 1
SPECIAL_TOKENS = ("[UNK]", "[BOS]", "[EOS]", "[PAD]")


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _require_sha256(value: Any, field: str) -> str:
    if (
        not isinstance(value, str) or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
    ):
        raise ValueError(f"{field} must be a lowercase SHA-256 hex digest")
    return value


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def iter_external_v3_train_text(
    train_manifest_path: str | Path,
    *,
    minimum_characters: int = 24,
) -> Iterator[dict[str, str]]:
    """Yield only unique, immutable, externally sourced V3 train text records.

    Tool, image, audio and video families are ignored. A record labelled as text
    but lacking the external-only provenance contract is a hard error.
    """
    if minimum_characters < 1:
        raise ValueError("minimum_characters must be positive")
    seen_ids: set[str] = set()
    seen_source_rows: set[str] = set()
    for record in read_v3_manifest(train_manifest_path):
        split = str(record.get("split", "")).strip()
        if split != "train":
            raise ValueError(
                f"V3 tokenizer input must contain train records only; "
                f"record {record.get('id', '<unknown>')} has split {split!r}"
            )
        if str(record.get("task", "")).strip() != "text":
            continue
        record_id = str(record.get("id", "")).strip()
        if not record_id:
            raise ValueError("V3 text tokenizer row is missing its record id")
        if record_id in seen_ids:
            raise ValueError(f"duplicate V3 train text record id: {record_id}")
        seen_ids.add(record_id)

        if record.get("data_class") != "external" or not external_record_is_trainable(record):
            raise ValueError(
                f"V3 tokenizer rejects non-external or synthetic text row: {record_id}"
            )
        if not has_immutable_external_provenance(record):
            raise ValueError(
                f"V3 tokenizer requires immutable source revision and row hash: {record_id}"
            )
        source_url = str(record.get("source_url", "")).strip()
        parsed = urlparse(source_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError(f"V3 tokenizer requires a valid external source URL: {record_id}")

        source_row_hash = str(record.get("source_row_id_sha256", "")).strip().lower()
        if source_row_hash in seen_source_rows:
            raise ValueError(f"duplicate external source-row hash in V3 train text: {record_id}")
        seen_source_rows.add(source_row_hash)

        text = record.get("text")
        if not isinstance(text, str):
            raise ValueError(f"V3 external text row has no text string: {record_id}")
        text = " ".join(text.split())
        if len(text) < minimum_characters:
            raise ValueError(f"V3 external text row is too short for tokenizer training: {record_id}")
        yield {
            "id": record_id,
            "source_id": str(record["source_id"]),
            "source_revision": str(record["source_revision"]).lower(),
            "source_row_id_sha256": source_row_hash,
            "text": text,
        }


def _write_new_file(path: Path, payload: bytes) -> Path:
    fd, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".partial", dir=path.parent
    )
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
    except Exception:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise
    return Path(temporary)


def train_v3_tokenizer(
    train_manifest_path: str | Path,
    output_path: str | Path,
    *,
    config: V3Config | None = None,
    minimum_text_records: int = 100,
    minimum_characters: int = 24,
    min_frequency: int = 2,
) -> dict[str, Any]:
    """Fit the exact configured V3 BPE vocabulary using external train text only."""
    config = config or V3Config()
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    if minimum_text_records < 100 or min_frequency < 1:
        raise ValueError("V3 tokenizer requires at least 100 external train-text rows and positive min_frequency")

    manifest = Path(train_manifest_path).resolve()
    if not manifest.is_file():
        raise FileNotFoundError(f"V3 train manifest not found: {manifest}")
    manifest_sha256 = sha256_file(manifest)
    target = Path(output_path).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    evidence_path = target.with_name(target.name + ".evidence.json")
    if target.exists() or evidence_path.exists():
        raise FileExistsError(
            "V3 tokenizer artifacts already exist; use a new versioned output path"
        )

    state: dict[str, Any] = {
        "records": 0,
        "text_rows_sha256": hashlib.sha256(),
    }

    def text_iterator():
        for row in iter_external_v3_train_text(
            manifest, minimum_characters=minimum_characters
        ):
            identity = {
                "id": row["id"],
                "source_id": row["source_id"],
                "source_revision": row["source_revision"],
                "source_row_id_sha256": row["source_row_id_sha256"],
                "text": row["text"],
            }
            encoded = json.dumps(
                identity, ensure_ascii=False, sort_keys=True, separators=(",", ":")
            ).encode("utf-8")
            state["text_rows_sha256"].update(encoded + b"\n")
            state["records"] += 1
            yield row["text"]

    tokenizer = Tokenizer(models.BPE(unk_token=SPECIAL_TOKENS[0]))
    tokenizer.normalizer = normalizers.NFC()
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    trainer = trainers.BpeTrainer(
        vocab_size=config.text_vocab_size,
        min_frequency=min_frequency,
        special_tokens=list(SPECIAL_TOKENS),
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
        show_progress=False,
    )
    tokenizer.train_from_iterator(text_iterator(), trainer=trainer)

    if state["records"] < minimum_text_records:
        raise ValueError(
            f"V3 tokenizer requires at least {minimum_text_records} external train text rows; "
            f"found {state['records']}"
        )
    if sha256_file(manifest) != manifest_sha256:
        raise RuntimeError("V3 train manifest changed while the tokenizer was being trained")

    actual_vocab_size = int(tokenizer.get_vocab_size(with_added_tokens=True))
    if actual_vocab_size != config.text_vocab_size:
        raise ValueError(
            f"V3 tokenizer learned {actual_vocab_size} tokens; "
            f"the exact configured vocabulary is {config.text_vocab_size}"
        )
    special_token_ids = {
        token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS
    }
    if any(value is None for value in special_token_ids.values()):
        raise ValueError("V3 tokenizer is missing one or more required special tokens")

    tokenizer_json = tokenizer.to_str(pretty=False).encode("utf-8")
    tokenizer_sha256 = _sha256_bytes(tokenizer_json)
    evidence = {
        "format_version": FORMAT_VERSION,
        "architecture_family": "onecore-v3",
        "architecture_version": config.architecture_version,
        "config_sha256": config.fingerprint,
        "tokenizer_algorithm": "byte-level BPE",
        "unicode_normalization": "NFC",
        "vocab_size_requested": config.text_vocab_size,
        "vocab_size_actual": actual_vocab_size,
        "special_tokens": list(SPECIAL_TOKENS),
        "special_token_ids": special_token_ids,
        "training_split": "train",
        "training_family": "text",
        "data_class": "external",
        "external_train_text_records": int(state["records"]),
        "train_manifest_sha256": manifest_sha256,
        "external_text_rows_sha256": state["text_rows_sha256"].hexdigest(),
        "minimum_text_records_required": int(minimum_text_records),
        "tokenizer_sha256": tokenizer_sha256,
        "tokenizer_file": target.name,
        "validation_or_test_rows_used": 0,
        "v2_tokenizer_imported": False,
    }
    evidence_json = (
        json.dumps(evidence, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")

    tokenizer_temp = _write_new_file(target, tokenizer_json)
    evidence_temp = _write_new_file(evidence_path, evidence_json)
    try:
        os.replace(tokenizer_temp, target)
        os.replace(evidence_temp, evidence_path)
    except Exception:
        target.unlink(missing_ok=True)
        evidence_path.unlink(missing_ok=True)
        raise
    finally:
        tokenizer_temp.unlink(missing_ok=True)
        evidence_temp.unlink(missing_ok=True)

    return {
        **evidence,
        "tokenizer_path": str(target),
        "evidence_path": str(evidence_path),
    }


def verify_v3_tokenizer(
    tokenizer_path: str | Path,
    *,
    config: V3Config | None = None,
    expected_train_manifest_sha256: str | None = None,
) -> dict[str, Any]:
    """Verify tokenizer bytes, exact vocabulary and the external-train evidence sidecar."""
    config = config or V3Config()
    if not isinstance(config, V3Config):
        raise TypeError("config must be a V3Config instance")
    target = Path(tokenizer_path).resolve()
    evidence_path = target.with_name(target.name + ".evidence.json")
    if not target.is_file() or not evidence_path.is_file():
        raise FileNotFoundError("V3 tokenizer JSON and evidence sidecar are both required")
    tokenizer_json = target.read_bytes()
    actual_sha = _sha256_bytes(tokenizer_json)
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    if not isinstance(evidence, dict):
        raise ValueError("V3 tokenizer evidence sidecar must be a JSON object")
    try:
        serialized = json.loads(tokenizer_json.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"V3 tokenizer JSON is invalid: {exc}") from exc
    if (
        not isinstance(serialized, dict)
        or not isinstance(serialized.get("model"), dict)
        or serialized["model"].get("type") != "BPE"
        or not isinstance(serialized.get("normalizer"), dict)
        or serialized["normalizer"].get("type") != "NFC"
        or not isinstance(serialized.get("pre_tokenizer"), dict)
        or serialized["pre_tokenizer"].get("type") != "ByteLevel"
        or not isinstance(serialized.get("decoder"), dict)
        or serialized["decoder"].get("type") != "ByteLevel"
    ):
        raise ValueError("V3 tokenizer must use NFC-normalized byte-level BPE")
    try:
        tokenizer = Tokenizer.from_str(tokenizer_json.decode("utf-8"))
    except Exception as exc:
        raise ValueError(f"V3 tokenizer serialization is invalid: {exc}") from exc
    actual_vocab_size = int(tokenizer.get_vocab_size(with_added_tokens=True))

    evidence_version = evidence.get("format_version")
    if isinstance(evidence_version, bool) or not isinstance(evidence_version, int) or evidence_version != FORMAT_VERSION:
        raise ValueError("unsupported V3 tokenizer evidence format")
    if evidence.get("architecture_family") != "onecore-v3":
        raise ValueError("tokenizer evidence is not for OneCore V3")
    if evidence.get("architecture_version") != config.architecture_version:
        raise ValueError("V3 tokenizer architecture version mismatch")
    if evidence.get("config_sha256") != config.fingerprint:
        raise ValueError("V3 tokenizer configuration fingerprint mismatch")
    if evidence.get("tokenizer_sha256") != actual_sha:
        raise ValueError("V3 tokenizer file SHA-256 mismatch")
    if evidence.get("tokenizer_file") != target.name:
        raise ValueError("V3 tokenizer evidence filename mismatch")
    if evidence.get("vocab_size_actual") != actual_vocab_size:
        raise ValueError("V3 tokenizer vocabulary metadata mismatch")
    if actual_vocab_size != config.text_vocab_size:
        raise ValueError("V3 tokenizer does not match the exact configured vocabulary size")
    if evidence.get("tokenizer_algorithm") != "byte-level BPE":
        raise ValueError("V3 tokenizer algorithm evidence mismatch")
    if evidence.get("unicode_normalization") != "NFC":
        raise ValueError("V3 tokenizer normalization evidence mismatch")
    if evidence.get("special_tokens") != list(SPECIAL_TOKENS):
        raise ValueError("V3 tokenizer special-token contract mismatch")
    actual_special_ids = {token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS}
    if any(token_id is None for token_id in actual_special_ids.values()):
        raise ValueError("V3 tokenizer is missing one or more required special tokens")
    if evidence.get("special_token_ids") != actual_special_ids:
        raise ValueError("V3 tokenizer special-token IDs do not match the evidence sidecar")
    if evidence.get("training_split") != "train" or evidence.get("training_family") != "text":
        raise ValueError("V3 tokenizer was not fitted on train text only")
    if evidence.get("data_class") != "external":
        raise ValueError("V3 tokenizer evidence violates the external-only train gate")
    rows_used = evidence.get("external_train_text_records")
    minimum_rows = evidence.get("minimum_text_records_required")
    if (
        isinstance(rows_used, bool) or not isinstance(rows_used, int) or rows_used < 100
        or isinstance(minimum_rows, bool) or not isinstance(minimum_rows, int)
        or minimum_rows < 100 or rows_used < minimum_rows
    ):
        raise ValueError("V3 tokenizer does not meet the minimum external train-text row count")
    heldout_rows = evidence.get("validation_or_test_rows_used")
    if isinstance(heldout_rows, bool) or not isinstance(heldout_rows, int) or heldout_rows != 0:
        raise ValueError("V3 tokenizer used validation or test records")
    if evidence.get("v2_tokenizer_imported") is not False:
        raise ValueError("V3 tokenizer evidence does not explicitly exclude V2 tokenizer import")
    _require_sha256(evidence.get("train_manifest_sha256"), "train_manifest_sha256")
    _require_sha256(evidence.get("external_text_rows_sha256"), "external_text_rows_sha256")
    if expected_train_manifest_sha256 is not None and (
        evidence.get("train_manifest_sha256") != expected_train_manifest_sha256
    ):
        raise ValueError("V3 tokenizer training manifest fingerprint mismatch")
    return {**evidence, "tokenizer_path": str(target), "evidence_path": str(evidence_path)}



def main() -> None:
    """Train or verify the isolated V3 tokenizer from its external train manifest."""
    parser = argparse.ArgumentParser(description="OneCore V3 external-only tokenizer utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    train_parser = subparsers.add_parser(
        "train", help="fit the exact configured BPE vocabulary on external V3 train text"
    )
    train_parser.add_argument("--train-manifest", required=True)
    train_parser.add_argument("--output", required=True)
    train_parser.add_argument("--minimum-text-records", type=int, default=100)
    train_parser.add_argument("--minimum-characters", type=int, default=24)
    train_parser.add_argument("--min-frequency", type=int, default=2)

    verify_parser = subparsers.add_parser(
        "verify", help="verify V3 tokenizer bytes and evidence sidecar"
    )
    verify_parser.add_argument("--tokenizer", required=True)
    verify_parser.add_argument("--expected-train-manifest-sha256")

    arguments = parser.parse_args()
    if arguments.command == "train":
        result = train_v3_tokenizer(
            arguments.train_manifest,
            arguments.output,
            minimum_text_records=arguments.minimum_text_records,
            minimum_characters=arguments.minimum_characters,
            min_frequency=arguments.min_frequency,
        )
    else:
        result = verify_v3_tokenizer(
            arguments.tokenizer,
            expected_train_manifest_sha256=arguments.expected_train_manifest_sha256,
        )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
