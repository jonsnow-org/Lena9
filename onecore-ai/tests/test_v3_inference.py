import hashlib

import pytest
import torch
from tokenizers import Tokenizer, models, pre_tokenizers

from onecore.v3.checkpoint import save_v3_checkpoint
from onecore.v3.config import V3Config
from onecore.v3.inference import OneCoreV3Inference


def _config():
    return V3Config(
        text_vocab_size=64,
        width=32,
        layers=1,
        cycles=2,
        attention_heads=4,
        patch_size=4,
        audio_latent_channels=8,
        audio_hidden_channels=16,
        audio_codebook_size=16,
        audio_quantizer_stages=2,
        audio_channels=1,
        temporal_layers=1,
        max_image_context_tokens=8,
        max_video_context_tokens=8,
        max_flow_context_tokens=8,
        temporal_window_frames=4,
        temporal_memory_frames=1,
        video_generation_chunk_frames=2,
        dropout=0.0,
    )


def _tokenizer_json(vocab_size=64):
    vocab = {"[UNK]": 0, "[BOS]": 1, "[EOS]": 2, "[PAD]": 3}
    vocab.update({f"piece_{index}": index for index in range(4, vocab_size)})
    tokenizer = Tokenizer(models.BPE(vocab=vocab, merges=[], unk_token="[UNK]"))
    tokenizer.pre_tokenizer = pre_tokenizers.Whitespace()
    tokenizer.add_special_tokens(["[UNK]", "[BOS]", "[EOS]", "[PAD]"])
    return tokenizer.to_str().encode("utf-8")


def _data_state(manifest_sha):
    families = {}
    source_cursors = {}
    for family in ("text", "tool", "image", "audio", "video"):
        source_id = f"fixture-{family}"
        revision = "c" * 40
        families[family] = {"rows_consumed": 12, "last_record_id": f"{family}-record-12"}
        source_cursors[f"{family}::{source_id}@{revision}"] = {
            "family": family,
            "source_id": source_id,
            "source_revision": revision,
            "source_url": f"https://example.org/{source_id}",
            "data_class": "external",
            "split": "train",
            "rows_consumed": 12,
            "cursor_state": {"mode": "offset", "offset": 12},
            "last_source_row_id_sha256": hashlib.sha256(
                f"{family}-source-row-12".encode()
            ).hexdigest(),
        }
    return {
        "format_version": 1,
        "manifest_sha256": manifest_sha,
        "split": "train",
        "families": families,
        "source_cursors": source_cursors,
    }


def _checkpoint(path):
    config = _config()
    torch.manual_seed(101)
    model = config.build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.8)
    tokenizer_json = _tokenizer_json(config.text_vocab_size)
    manifest_sha = "a" * 64
    saved = save_v3_checkpoint(
        path,
        model,
        optimizer,
        scheduler,
        7,
        config,
        tokenizer_json=tokenizer_json,
        manifest_sha256=manifest_sha,
        data_state=_data_state(manifest_sha),
        lineage={
            "run_id": "v3-inference-test",
            "session": 1,
            "parent_checkpoint_sha256": None,
        },
    )
    return config, saved


def test_v3_inference_loads_hash_pinned_checkpoint_and_generates_text(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    config, saved = _checkpoint(checkpoint)
    runtime = OneCoreV3Inference.from_checkpoint(
        checkpoint,
        expected_checkpoint_sha256=saved["sha256"],
        device="cpu",
    )

    assert runtime.config.fingerprint == config.fingerprint
    assert runtime.global_step == 7
    assert runtime.checkpoint_sha256 == saved["sha256"]
    assert runtime._prompt_ids("Explain the model")[-1] != runtime.special_ids["[EOS]"]
    assert runtime._prompt_ids("Explain the model", append_eos=True)[-1] == runtime.special_ids["[EOS]"]
    assert not runtime.model.training
    assert all(not parameter.requires_grad for parameter in runtime.model.parameters())

    result = runtime.generate_text(
        "Explain the model",
        max_new_tokens=4,
        temperature=0,
        max_context_tokens=8,
    )
    assert isinstance(result, str)


def test_v3_inference_generates_all_three_media_shapes(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    _, saved = _checkpoint(checkpoint)
    runtime = OneCoreV3Inference.from_checkpoint(
        checkpoint, expected_checkpoint_sha256=saved["sha256"]
    )

    image = runtime.generate_image("a small landscape", height=13, width=19, steps=1)
    audio = runtime.generate_audio("a short tone", samples=129, steps=1)
    video = runtime.generate_video(
        "a moving object", frames=5, height=13, width=19, steps=1, chunk_frames=2
    )

    assert image.shape == (1, 3, 13, 19)
    assert audio.shape == (1, 1, 129)
    assert video.shape == (1, 5, 3, 13, 19)
    assert torch.isfinite(image).all()
    assert torch.isfinite(audio).all()
    assert torch.isfinite(video).all()


def test_v3_inference_rejects_wrong_checkpoint_digest_before_deserialization(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    _checkpoint(checkpoint)
    with pytest.raises(ValueError, match="does not match the trusted artifact digest"):
        OneCoreV3Inference.from_checkpoint(
            checkpoint, expected_checkpoint_sha256="0" * 64
        )


def test_v3_inference_refuses_untrained_checkpoints_by_default(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    config = _config()
    model = config.build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=1, gamma=0.8)
    tokenizer_json = _tokenizer_json(config.text_vocab_size)
    manifest_sha = "a" * 64
    saved = save_v3_checkpoint(
        checkpoint,
        model,
        optimizer,
        scheduler,
        0,
        config,
        tokenizer_json=tokenizer_json,
        manifest_sha256=manifest_sha,
        data_state={
            "format_version": 1,
            "manifest_sha256": manifest_sha,
            "split": "train",
            "families": {
                family: {"rows_consumed": 0, "last_record_id": None}
                for family in ("text", "tool", "image", "audio", "video")
            },
            "source_cursors": {},
        },
        lineage={"run_id": "untrained-fixture", "session": 1, "parent_checkpoint_sha256": None},
    )
    with pytest.raises(ValueError, match="untrained checkpoint"):
        OneCoreV3Inference.from_checkpoint(
            checkpoint, expected_checkpoint_sha256=saved["sha256"]
        )
    runtime = OneCoreV3Inference.from_checkpoint(
        checkpoint,
        expected_checkpoint_sha256=saved["sha256"],
        allow_untrained=True,
    )
    assert runtime.global_step == 0


def test_v3_inference_validates_sampling_arguments(tmp_path):
    checkpoint = tmp_path / "checkpoint.pt"
    _, saved = _checkpoint(checkpoint)
    runtime = OneCoreV3Inference.from_checkpoint(
        checkpoint, expected_checkpoint_sha256=saved["sha256"]
    )
    with pytest.raises(ValueError, match="must not be empty"):
        runtime.generate_text("  ")
    with pytest.raises(ValueError, match="temperature"):
        runtime.generate_text("hello", temperature=-1)
