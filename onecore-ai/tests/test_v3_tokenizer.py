import hashlib
import json

import pytest
from tokenizers import Tokenizer, decoders, models, normalizers, pre_tokenizers

from onecore.v3 import V3Config
from onecore.v3.tokenizer import (
    SPECIAL_TOKENS,
    adopt_v3_tokenizer,
    _tokenizer_contract_sha256,
    iter_external_v3_train_text,
    train_v3_tokenizer,
    verify_v3_tokenizer,
)


def _row_hash(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _external_text_record(index, *, split="train", data_class="external"):
    return {
        "id": f"external-text-{index}",
        "task": "text",
        "split": split,
        "data_class": data_class,
        "source_id": f"source-{index}",
        "source_revision": "a" * 40,
        "source_row_id_sha256": _row_hash(f"source-row-{index}"),
        "source_url": "https://example.org/dataset/train",
        "text": (
            "OneCore has one shared semantic transformer for language, tools, "
            "image, audio, and video tasks. "
            f"External corpus sentence sequence {index} includes stable text tokens."
        ),
    }


def _write_train_manifest(path, rows):
    path.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )


def _tiny_config():
    return V3Config(text_vocab_size=264)


def test_iter_external_v3_train_text_filters_non_text_and_requires_external_lineage(tmp_path):
    rows = [
        _external_text_record(1),
        {**_external_text_record(2), "task": "tool_use", "prompt": "Search source"},
    ]
    path = tmp_path / "train.jsonl"
    _write_train_manifest(path, rows)

    records = list(iter_external_v3_train_text(path, minimum_characters=24))
    assert len(records) == 1
    assert records[0]["id"] == "external-text-1"
    assert records[0]["source_revision"] == "a" * 40


@pytest.mark.parametrize(
    ("record", "message"),
    [
        ({**_external_text_record(1), "data_class": "bootstrap"}, "non-external or synthetic"),
        ({**_external_text_record(1), "data_class": "owner_curated"}, "non-external or synthetic"),
        ({**_external_text_record(1), "data_class": "unapproved"}, "non-external or synthetic"),
        ({**_external_text_record(1), "split": "validation"}, "train records only"),
        ({**_external_text_record(1), "source_revision": "main"}, "immutable source revision"),
        ({**_external_text_record(1), "source_row_id_sha256": "bad"}, "immutable source revision"),
        ({**_external_text_record(1), "source_url": "https://"}, "valid external source URL"),
    ],
)
def test_iter_external_v3_train_text_rejects_nonexternal_or_unpinned_rows(tmp_path, record, message):
    path = tmp_path / "train.jsonl"
    _write_train_manifest(path, [record])
    with pytest.raises(ValueError, match=message):
        list(iter_external_v3_train_text(path))


def test_train_and_verify_v3_tokenizer_uses_exact_vocabulary_and_external_train_only(tmp_path):
    config = _tiny_config()
    manifest = tmp_path / "train.jsonl"
    _write_train_manifest(manifest, [_external_text_record(index) for index in range(100)])
    tokenizer_path = tmp_path / "onecore-v3-264.json"

    report = train_v3_tokenizer(
        manifest,
        tokenizer_path,
        config=config,
        minimum_text_records=100,
        minimum_characters=24,
        min_frequency=1,
    )
    assert report["vocab_size_requested"] == 264
    assert report["vocab_size_actual"] == 264
    assert report["external_train_text_records"] == 100
    assert report["training_split"] == "train"
    assert report["training_family"] == "text"
    assert report["data_class"] == "external"
    assert report["validation_or_test_rows_used"] == 0
    assert report["v2_tokenizer_imported"] is False
    assert set(report["special_tokens"]) == set(SPECIAL_TOKENS)

    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    assert tokenizer.get_vocab_size(with_added_tokens=True) == 264
    assert all(tokenizer.token_to_id(token) is not None for token in SPECIAL_TOKENS)

    verified = verify_v3_tokenizer(
        tokenizer_path,
        config=config,
        expected_train_manifest_sha256=report["train_manifest_sha256"],
    )
    assert verified["tokenizer_sha256"] == report["tokenizer_sha256"]
    assert verified["external_text_rows_sha256"] == report["external_text_rows_sha256"]


def test_adopt_v3_tokenizer_preserves_original_bytes_and_rebinds_only_evidence(tmp_path):
    config = V3Config()
    vocab = {token: index for index, token in enumerate(SPECIAL_TOKENS)}
    for token in sorted(pre_tokenizers.ByteLevel.alphabet()):
        if token not in vocab:
            vocab[token] = len(vocab)
    while len(vocab) < config.text_vocab_size:
        token = f"<unused_{len(vocab):05d}>"
        if token not in vocab:
            vocab[token] = len(vocab)
    tokenizer = Tokenizer(models.BPE(vocab=vocab, merges=[], unk_token=SPECIAL_TOKENS[0]))
    tokenizer.normalizer = normalizers.NFC()
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    token_bytes = tokenizer.to_str(pretty=False).encode("utf-8")
    source = tmp_path / "source-32k.json"
    source.write_bytes(token_bytes)
    special_ids = {token: tokenizer.token_to_id(token) for token in SPECIAL_TOKENS}
    manifest_sha = "a" * 64
    rows_sha = "b" * 64
    evidence = {
        "format_version": 1,
        "architecture_family": "onecore-v3",
        "architecture_version": "onecore-v3-prototype-2",
        "config_sha256": "c" * 64,
        "tokenizer_algorithm": "byte-level BPE",
        "unicode_normalization": "NFC",
        "vocab_size_requested": 32000,
        "vocab_size_actual": 32000,
        "special_tokens": list(SPECIAL_TOKENS),
        "special_token_ids": special_ids,
        "training_split": "train",
        "training_family": "text",
        "data_class": "external",
        "external_train_text_records": 100,
        "train_manifest_sha256": manifest_sha,
        "external_text_rows_sha256": rows_sha,
        "minimum_text_records_required": 100,
        "tokenizer_sha256": hashlib.sha256(token_bytes).hexdigest(),
        "tokenizer_file": source.name,
        "validation_or_test_rows_used": 0,
        "v2_tokenizer_imported": False,
    }
    source_evidence = source.with_name(source.name + ".evidence.json")
    source_evidence.write_text(json.dumps(evidence, sort_keys=True), encoding="utf-8")
    source_evidence_sha = hashlib.sha256(source_evidence.read_bytes()).hexdigest()
    output = tmp_path / "adopted-32k.json"
    adopted = adopt_v3_tokenizer(
        source, source_evidence, output, config=config,
        expected_source_tokenizer_sha256=hashlib.sha256(token_bytes).hexdigest(),
        expected_source_evidence_sha256=source_evidence_sha,
        expected_train_manifest_sha256=manifest_sha,
        expected_external_text_rows_sha256=rows_sha,
        expected_external_train_text_records=100,
        source_run_id=123, source_artifact_id=456,
        source_artifact_sha256="sha256:" + "d" * 64,
    )
    verified = verify_v3_tokenizer(output, config=config, expected_train_manifest_sha256=manifest_sha)
    assert output.read_bytes() == token_bytes == source.read_bytes()
    assert adopted["source_tokenizer_bytes_preserved"] is True
    assert adopted["adopted_from"]["refit_performed"] is False
    assert verified["vocab_size_actual"] == 32000
    assert verified["tokenizer_contract_sha256"] == _tokenizer_contract_sha256(config, special_ids)
    assert verified["config_sha256"] == config.fingerprint
    assert verified["adopted_from"]["source_run_id"] == 123


def test_train_v3_tokenizer_rejects_bootstrap_text_before_writing_any_artifact(tmp_path):
    manifest = tmp_path / "train.jsonl"
    _write_train_manifest(manifest, [
        {**_external_text_record(index), "data_class": "bootstrap"}
        for index in range(100)
    ])
    output = tmp_path / "must-not-exist.json"
    with pytest.raises(ValueError, match="non-external or synthetic"):
        train_v3_tokenizer(
            manifest, output, config=_tiny_config(), minimum_text_records=100
        )
    assert not output.exists()
    assert not output.with_name(output.name + ".evidence.json").exists()


def test_verify_v3_tokenizer_rejects_changed_bytes_special_token_evidence_and_manifest(tmp_path):
    config = _tiny_config()
    manifest = tmp_path / "train.jsonl"
    _write_train_manifest(manifest, [_external_text_record(index) for index in range(100)])
    output = tmp_path / "onecore-v3.json"
    report = train_v3_tokenizer(
        manifest, output, config=config, minimum_text_records=100, min_frequency=1
    )
    original = output.read_bytes()
    evidence_path = output.with_name(output.name + ".evidence.json")
    original_evidence = evidence_path.read_text(encoding="utf-8")

    output.write_bytes(original + b" ")
    with pytest.raises(ValueError, match="file SHA-256 mismatch"):
        verify_v3_tokenizer(output, config=config)
    output.write_bytes(original)

    evidence = json.loads(original_evidence)
    evidence["special_token_ids"]["[BOS]"] += 100
    evidence_path.write_text(json.dumps(evidence), encoding="utf-8")
    with pytest.raises(ValueError, match="special-token IDs"):
        verify_v3_tokenizer(output, config=config)
    evidence_path.write_text(original_evidence, encoding="utf-8")

    changed_manifest_hash = hashlib.sha256(manifest.read_bytes() + b" ").hexdigest()
    with pytest.raises(ValueError, match="training manifest fingerprint mismatch"):
        verify_v3_tokenizer(
            output,
            config=config,
            expected_train_manifest_sha256=changed_manifest_hash,
        )
    assert report["tokenizer_sha256"] == hashlib.sha256(original).hexdigest()


def test_train_v3_tokenizer_refuses_a_minimum_below_100_rows(tmp_path):
    with pytest.raises(ValueError, match="at least 100"):
        train_v3_tokenizer(
            tmp_path / "missing.jsonl",
            tmp_path / "not-created.json",
            config=_tiny_config(),
            minimum_text_records=1,
        )


def test_train_v3_tokenizer_refuses_to_overwrite_existing_artifacts(tmp_path):
    manifest = tmp_path / "train.jsonl"
    _write_train_manifest(manifest, [_external_text_record(index) for index in range(100)])
    output = tmp_path / "existing.json"
    output.write_text("do not overwrite", encoding="utf-8")
    with pytest.raises(FileExistsError, match="already exist"):
        train_v3_tokenizer(
            manifest, output, config=_tiny_config(), minimum_text_records=100
        )


@pytest.mark.parametrize("data_class", ["external_staged", "external_reviewed"])
def test_iter_external_v3_train_text_accepts_canonical_external_aliases(tmp_path, data_class):
    path = tmp_path / "train.jsonl"
    _write_train_manifest(path, [{**_external_text_record(1), "data_class": data_class}])
    records = list(iter_external_v3_train_text(path))
    assert len(records) == 1
    assert records[0]["id"] == "external-text-1"
    assert records[0]["source_revision"] == "a" * 40
