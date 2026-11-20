from __future__ import annotations

from pathlib import Path

from tokenizers import Tokenizer, decoders, models, pre_tokenizers, trainers


def train_tokenizer(corpus_files: list[str | Path], output_path: str | Path,
                    vocab_size: int = 4096) -> Tokenizer:
    """Train a fresh byte-level BPE tokenizer. No tokenizer files are imported."""
    paths = [str(Path(p)) for p in corpus_files if Path(p).is_file()]
    if not paths:
        raise FileNotFoundError("no approved text corpus files were supplied")
    tokenizer = Tokenizer(models.BPE(unk_token="[UNK]"))
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)
    tokenizer.decoder = decoders.ByteLevel()
    special = ["[PAD]", "[BOS]", "[EOS]", "[UNK]"]
    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        min_frequency=2,
        special_tokens=special,
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
        show_progress=True,
    )
    tokenizer.train(paths, trainer)
    if tokenizer.get_vocab_size() > vocab_size:
        raise RuntimeError("trained tokenizer exceeded requested vocabulary")
    tokenizer.save(str(output_path))
    return tokenizer


def load_tokenizer(path: str | Path) -> Tokenizer:
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"tokenizer not found: {p}")
    return Tokenizer.from_file(str(p))
