import torch

from onecore.v3 import V3Config

def tiny_config(**overrides):
    values = dict(architecture_version="onecore-v3-test-fixture", width=32, unique_blocks=1,
                  recurrent_cycles=2, attention_heads=4, max_sequence_length=128,
                  text_vocab_size=64, vision_codebook_size=16, audio_codebook_size=8,
                  motion_codebook_size=8, special_tokens=24, patch_size=8, image_size=32,
                  audio_bins=8, audio_group_frames=2, audio_sample_rate=24000,
                  audio_channels=1, max_video_frames=4, tldm_latent_slots=4, dropout=0.0)
    values.update(overrides)
    return V3Config(**values)


def test_image_audio_motion_codecs_are_projection_heads_of_one_shared_vocabulary():
    torch.manual_seed(7)
    model = tiny_config().build_model()
    image = torch.rand(2, 3, 32, 32, requires_grad=True)
    image_ids, image_latents, image_loss = model.encode_image(image)
    image_out = model.decode_image_latents(image_latents)
    assert image_ids.shape == (2, 16)
    assert image_out.shape == image.shape
    assert torch.isfinite(image_loss)

    mel = torch.rand(2, 8, 8, requires_grad=True)
    audio_ids, audio_latents, audio_loss = model.encode_audio(mel)
    audio_out = model.decode_audio_latents(audio_latents)
    assert audio_ids.shape == (2, 4)
    assert audio_out.shape == (2, 4, 16)
    assert torch.isfinite(audio_loss)

    differences = torch.randn(2, 3, 3, 32, 32, requires_grad=True)
    motion_ids, motion_latents, motion_loss = model.encode_motion(differences.flatten(0, 1))
    motion_out = model.decode_motion_latents(motion_latents)
    assert motion_ids.shape == (6, 16)
    assert motion_out.shape == differences.flatten(0, 1).shape
    (
        image_out.square().mean() + audio_out.square().mean() + motion_out.square().mean()
        + image_loss + audio_loss + motion_loss
    ).backward()
    assert model.token_embedding.weight.grad is not None
    assert image.grad is not None and mel.grad is not None and differences.grad is not None


def test_audio_frontend_uses_configured_24khz_log_mel_representation():
    model = tiny_config().build_model()
    mel = model._waveform_to_log_mel(torch.randn(1, 2048), 24000)
    assert mel.ndim == 3 and mel.shape[0] == 1 and mel.shape[-1] == model.cfg.audio_bins
    assert torch.isfinite(mel).all()
    try:
        model._waveform_to_log_mel(torch.randn(1, 2048), 44100)
    except ValueError as exc:
        assert "24 kHz" in str(exc)
    else:
        raise AssertionError("non-24-kHz input must fail closed")


def test_model_enforces_fixed_64x64_and_maximum_four_video_frames():
    model = V3Config().build_model().eval()
    reconstructed, state = model.forward_image(torch.rand(1, 3, 91, 137))
    assert reconstructed.shape == (1, 3, 64, 64)
    assert state.tokens.shape == (1, 64)
    video = torch.rand(1, 4, 3, 48, 96)
    chunks = list(model.forward_video_chunks(video, frame_chunk_size=2))
    assert [tuple(x.shape) for x in chunks] == [(1,2,3,64,64),(1,2,3,64,64)]
    try:
        list(model.forward_video_chunks(torch.rand(1,5,3,64,64)))
    except ValueError as exc:
        assert "1..4 frames" in str(exc)
    else:
        raise AssertionError("more than four frames must be rejected")


def test_tldm_has_no_separate_trainable_parameter_tower():
    model = tiny_config().build_model()
    assert model.lm_head.weight is model.token_embedding.weight
    assert not any("tldm" in name.lower() for name, _ in model.named_parameters())
    assert len({id(p) for p in model.parameters()}) == len(list(model.parameters()))
