from pathlib import Path

import pytest
import torch

from onecore.config import ModelConfig, load_config
from onecore.model import OneCore


def tiny_config():
    return ModelConfig(
        width=32, unique_blocks=2, recurrent_cycles=2, attention_heads=4,
        max_sequence_length=160, text_vocab_size=64, vision_codebook_size=16,
        audio_codebook_size=8, motion_codebook_size=8, special_tokens=24,
        patch_size=4, image_size=16, audio_bins=8, audio_group_frames=2,
        max_video_frames=3, dropout=0.0,
    )


def test_one_shared_core_and_exact_parameter_accounting():
    cfg = tiny_config()
    model = OneCore(cfg)
    assert model.lm_head.weight is model.token_embedding.weight
    assert len(model.blocks) == cfg.unique_blocks
    assert model.parameter_report()["effective_block_applications"] == 4
    assert model.count_parameters() == sum(p.numel() for p in model.parameters())
    ids = torch.randint(0, cfg.text_vocab_size, (2, 12))
    logits = model(ids)
    assert logits.shape == (2, 12, cfg.vocab_size)
    assert torch.isfinite(logits).all()


def test_image_audio_and_motion_codecs_share_the_same_embedding_space():
    cfg = tiny_config()
    model = OneCore(cfg)
    images = torch.rand(2, 3, cfg.image_size, cfg.image_size)
    image_ids, image_latents, image_vq = model.encode_image(images)
    image_reconstruction = model.decode_image_latents(image_latents)
    assert image_ids.min() >= cfg.vision_start
    assert image_ids.max() < cfg.audio_start
    assert image_reconstruction.shape == images.shape

    mel = torch.randn(2, 10, cfg.audio_bins)
    audio_ids, audio_latents, audio_vq = model.encode_audio(mel)
    decoded_mel = model.decode_audio_latents(audio_latents).reshape(
        2, -1, cfg.audio_bins
    )[:, :mel.shape[1]]
    assert audio_ids.min() >= cfg.audio_start
    assert audio_ids.max() < cfg.motion_start
    assert decoded_mel.shape == mel.shape

    differences = torch.randn_like(images)
    motion_ids, motion_latents, motion_vq = model.encode_motion(differences)
    motion_reconstruction = model.decode_motion_latents(motion_latents)
    assert motion_ids.min() >= cfg.motion_start
    assert motion_ids.max() < cfg.special_start
    assert motion_reconstruction.shape == differences.shape

    total = image_vq + audio_vq + motion_vq
    total = total + (image_reconstruction - images).pow(2).mean()
    total = total + (decoded_mel - mel).pow(2).mean()
    total = total + (motion_reconstruction - differences).pow(2).mean()
    total.backward()
    assert model.image_encoder.weight.grad is not None
    assert model.audio_encoder.weight.grad is not None
    assert model.motion_encoder.weight.grad is not None


def test_generation_can_be_constrained_to_a_modality_codebook():
    cfg = tiny_config()
    model = OneCore(cfg).eval()
    prompt = torch.tensor([[cfg.special_id(0), cfg.special_id(3)]])
    generated = model.generate(
        prompt, max_new_tokens=cfg.image_tokens_per_frame,
        allowed_range=(cfg.vision_start, cfg.audio_start), top_k=4,
    )
    codes = generated[:, prompt.shape[1]:]
    assert codes.shape[1] == cfg.image_tokens_per_frame
    assert torch.all((codes >= cfg.vision_start) & (codes < cfg.audio_start))
    decoded = model.decode_image_codes(codes)
    assert decoded.shape == (1, 3, cfg.image_size, cfg.image_size)

def test_unified_image_audio_and_video_generation():
    cfg = tiny_config()
    model = OneCore(cfg).eval()

    audio_codes, mel = model.generate_audio(code_count=3, top_k=4)
    assert audio_codes.shape == (1, 3)
    assert mel.shape == (1, 6, cfg.audio_bins)
    assert torch.all((audio_codes >= cfg.audio_start) & (audio_codes < cfg.motion_start))

    frames, video_stream = model.generate_video(frame_count=2, top_k=4)
    assert frames.shape == (2, 3, cfg.image_size, cfg.image_size)
    assert video_stream.ndim == 2
    assert torch.isfinite(frames).all()

def test_phone_research_config_exact_trainable_parameter_budget():
    root = Path(__file__).resolve().parents[1]
    cfg, _, _ = load_config(root / "configs" / "phone-research.yaml")
    model = OneCore(cfg)
    expected = 57_579_201
    actual = model.count_parameters()
    assert actual == expected
    assert model.parameter_report()["parameters"] == actual
    assert model.lm_head.weight is model.token_embedding.weight
    assert 50_000_000 <= actual <= 70_000_000



def test_tool_payload_generation_stops_at_trained_terminator(monkeypatch):
    from onecore.model import EOS, TOOL_END

    cfg = tiny_config()
    model = OneCore(cfg).eval()
    prompt = torch.tensor([[cfg.special_id(0), 7, cfg.special_id(10)]])
    captured = {}

    def fake_generate(prompt_ids, **kwargs):
        captured.update(kwargs)
        return prompt_ids

    monkeypatch.setattr(model, "generate", fake_generate)
    model.generate_tool_payload(prompt, max_new_tokens=24, temperature=0.4, top_k=8)
    allowed = captured["allowed_token_ids"]
    assert set(range(cfg.text_vocab_size)).issubset(set(allowed))
    assert cfg.special_id(TOOL_END) in allowed
    assert cfg.special_id(EOS) in allowed
    assert captured["stop_token_ids"] == [cfg.special_id(TOOL_END), cfg.special_id(EOS)]
    assert captured["max_new_tokens"] == 24
    assert captured["temperature"] == 0.4
    assert captured["top_k"] == 8


def test_native_tldm_uses_onecore_shared_parameters_and_iterative_writer():
    cfg = tiny_config()
    model = OneCore(cfg)
    original_count = model.count_parameters()
    mask_id = cfg.special_id(18)
    source = torch.tensor([[4, 9, 12, 15, 23, 31, 42, 51]])
    masked = source.clone()
    masked[:, 3:6] = mask_id

    logits = model.forward_tldm(masked, latent_slots=4)
    assert logits.shape == (1, source.shape[1], cfg.vocab_size)
    assert torch.isfinite(logits).all()
    loss = torch.nn.functional.cross_entropy(logits[:, 3:6].reshape(-1, cfg.vocab_size), source[:, 3:6].reshape(-1))
    loss.backward()
    assert model.token_embedding.weight.grad is not None
    assert model.blocks[0].attn.qkv.weight.grad is not None
    assert model.lm_head.weight is model.token_embedding.weight
    assert model.count_parameters() == original_count
    assert model.parameter_report()["tldm_additional_trainable_parameters"] == 0

    generated = model.generate_tldm(
        source[:, :3], block_size=5, diffusion_steps=4,
        latent_slots=4, allowed_token_ids=list(range(cfg.text_vocab_size)),
    )
    assert generated.shape == (1, 5)
    assert torch.all(generated < cfg.text_vocab_size)
    assert not torch.any(generated == mask_id)


def test_native_tldm_rejects_invalid_masked_generation_contract():
    cfg = tiny_config()
    model = OneCore(cfg)
    context = torch.tensor([[cfg.special_id(0), 5]])
    with pytest.raises(ValueError, match="exclude the mask token"):
        model.generate_tldm(
            context, block_size=3, allowed_token_ids=[cfg.special_id(18)]
        )


def test_native_tldm_diffusion_objective_trains_shared_onecore_weights():
    import random
    from onecore.train import _tldm_block_denoising_loss

    cfg = tiny_config()
    model = OneCore(cfg)
    sequence = torch.randint(0, cfg.text_vocab_size, (1, 20))
    loss = _tldm_block_denoising_loss(model, sequence, random.Random(17))
    assert loss.ndim == 0 and torch.isfinite(loss)
    assert loss.item() > 0
    loss.backward()
    assert model.token_embedding.weight.grad is not None
    assert model.blocks[0].mlp.gate.weight.grad is not None


def test_inference_session_exposes_native_tldm_decoding_mode():
    from onecore.inference import InferenceSession

    class TinyTokenizer:
        def encode(self, _text):
            return type("Encoded", (), {"ids": [5, 7, 9]})()

        def decode(self, _ids, skip_special_tokens=True):
            return "native diffusion output"

    session = InferenceSession(OneCore(tiny_config()), TinyTokenizer())
    answer = session.chat(
        "solve this", max_new_tokens=5, decoding="tldm",
        diffusion_steps=3, temperature=0.0, top_k=0,
    )
    assert answer == "native diffusion output"
