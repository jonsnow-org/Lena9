from pathlib import Path

from onecore.train import _manifest_corpus


def test_tokenizer_corpus_excludes_bootstrap_and_all_synthetic_records(tmp_path: Path) -> None:
    records = [
        {
            "id": "bootstrap-1",
            "split": "train",
            "data_class": "bootstrap",
            "text": "synthetic bootstrap sentinel",
        },
        {
            "id": "synthetic-verified-1",
            "split": "train",
            "data_class": "synthetic_verified",
            "caption": "verified synthetic sentinel",
        },
        {
            "id": "external-text-1",
            "split": "train",
            "data_class": "external_staged",
            "license": "cc-by-4.0",
            "source_url": "https://example.org/text",
            "attribution": "text dataset authors",
            "review_status": "pending",
            "source_id": "external-text-source",
            "source_revision": "a" * 40,
            "source_row_id_sha256": "b" * 64,
            "text": "authentic imported external text",
        },
        {
            "id": "external-tool-1",
            "split": "train",
            "data_class": "external_reviewed",
            "license": "apache-2.0",
            "source_url": "https://example.org/tools",
            "attribution": "tool dataset authors",
            "review_status": "approved",
            "source_id": "external-tool-source",
            "source_revision": "a" * 40,
            "source_row_id_sha256": "c" * 64,
            "prompt": "external tool prompt",
            "response": "external tool response",
        },
        {
            "id": "owner-curated-1",
            "split": "train",
            "data_class": "owner_curated",
            "text": "locally authored owner data sentinel",
        },
    ]

    output = tmp_path / "tokenizer-corpus.txt"
    paths = _manifest_corpus(records, output)
    corpus = paths[0].read_text(encoding="utf-8")

    assert "authentic imported external text" in corpus
    assert "external tool prompt" in corpus
    assert "external tool response" in corpus
    assert "synthetic bootstrap sentinel" not in corpus
    assert "verified synthetic sentinel" not in corpus
    assert "locally authored owner data sentinel" not in corpus
