import torch

from onecore.v3 import V3Config
from onecore.v3.core import MASK
from .test_v3_config import tiny_config


def test_single_shared_core_integrates_text_image_audio_motion_video():
    torch.manual_seed(23)
    model = tiny_config().build_model()
    text = torch.randint(0, model.cfg.text_vocab_size, (2, 11))
    logits = model.forward_text(text)
    assert logits.shape == (2, 11, model.cfg.vocab_size)

    image = torch.rand(1, 3, 29, 41)
    image_reconstruction, image_state = model.forward_image(image)
    assert image_reconstruction.shape == (1, 3, 32, 32)
    assert image_state.tokens.shape == (1, 16)

    audio = torch.randn(1, 2_048)
    audio_reconstruction, audio_state = model.forward_audio(audio, sample_rate=24_000)
    assert audio_reconstruction.ndim == 3
    assert audio_reconstruction.shape[-1] == model.cfg.audio_bins
    assert audio_state.tokens.shape[0] == 1

    video = torch.rand(1, 4, 3, 24, 24)
    chunks = list(model.forward_video_chunks(video, frame_chunk_size=2))
    video_reconstruction = torch.cat(chunks, dim=1)
    assert video_reconstruction.shape == (1, 4, 3, 32, 32)

    losses = logits.square().mean() + image_reconstruction.square().mean() + audio_reconstruction.square().mean() + video_reconstruction.square().mean()
    losses.backward()
    assert model.blocks[0].attn.qkv.weight.grad is not None
    assert model.image_encoder.weight.grad is not None
    assert model.audio_encoder.weight.grad is not None


def test_native_tldm_masks_token_identity_and_reuses_the_one_shared_transformer():
    torch.manual_seed(37)
    model = tiny_config().build_model().eval()
    ids = torch.randint(0, model.cfg.text_vocab_size, (2, 12))
    masked = ids.clone()
    masked[:, 3:7] = model.cfg.special_id(MASK)
    changed = ids.clone()
    changed[:, 3:7] = (changed[:, 3:7] + 19) % model.cfg.text_vocab_size
    changed[:, 3:7] = model.cfg.special_id(MASK)
    parameter_count = model.count_parameters()
    with torch.no_grad():
        first = model.forward_tldm(masked, latent_slots=model.cfg.tldm_latent_slots)
        second = model.forward_tldm(changed, latent_slots=model.cfg.tldm_latent_slots)
    assert first.shape == (2, 12, model.cfg.vocab_size)
    assert torch.allclose(first, second, atol=1e-6, rtol=1e-6)
    assert model.count_parameters() == parameter_count
    assert model.lm_head.weight is model.token_embedding.weight


def test_onecore_limits_context_and_rejects_invalid_shared_vocabulary_ids():
    model = tiny_config().build_model()
    try:
        model.forward_text(torch.zeros(1, model.cfg.max_sequence_length + 1, dtype=torch.long))
    except ValueError as exc:
        assert "maximum length" in str(exc)
    else:
        raise AssertionError("overlong token sequence must be rejected")
    try:
        model.forward_text(torch.tensor([[model.cfg.vocab_size]]))
    except ValueError as exc:
        assert "vocabulary" in str(exc)
    else:
        raise AssertionError("out-of-vocabulary token must be rejected")
