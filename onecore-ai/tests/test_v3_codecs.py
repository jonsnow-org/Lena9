import torch

from onecore.v3 import V3Config
from .test_v3_config import tiny_config


def test_shared_embedding_backed_image_audio_and_motion_codebooks():
    torch.manual_seed(7)
    model = tiny_config().build_model()
    image = torch.rand(2, 3, 32, 32, requires_grad=True)
    image_ids, image_latents, image_commitment = model.encode_image(image)
    reconstruction = model.decode_image_latents(image_latents)
    assert image_ids.shape == (2, 16)
    assert reconstruction.shape == image.shape
    assert torch.isfinite(image_commitment)

    mel = torch.rand(2, 6, model.cfg.audio_bins, requires_grad=True)
    audio_ids, audio_latents, audio_commitment = model.encode_audio(mel)
    audio_reconstruction = model.decode_audio_latents(audio_latents).reshape(2, -1, model.cfg.audio_token_dim)
    assert audio_ids.shape == (2, 3)
    assert audio_reconstruction.shape == (2, 3, model.cfg.audio_token_dim)
    assert torch.isfinite(audio_commitment)

    differences = torch.randn(2, 3, 3, 32, 32, requires_grad=True)
    motion_ids, motion_latents, motion_commitment = model.encode_motion(differences.flatten(0, 1))
    motion_reconstruction = model.decode_motion_latents(motion_latents)
    assert motion_ids.shape == (6, 16)
    assert motion_reconstruction.shape == differences.flatten(0, 1).shape
    loss = reconstruction.square().mean() + audio_reconstruction.square().mean() + motion_reconstruction.square().mean()
    loss.backward()
    assert image.grad is not None and torch.isfinite(image.grad).all()
    assert mel.grad is not None and torch.isfinite(mel.grad).all()
    assert differences.grad is not None and torch.isfinite(differences.grad).all()
    assert model.token_embedding.weight.grad is not None


def test_audio_preprocessing_requires_24khz_and_produces_80_bin_mel():
    model = V3Config().build_model()
    waveform = torch.randn(1, 24_000)
    mel = model._waveform_to_log_mel(waveform, 24_000)
    assert mel.ndim == 3
    assert mel.shape[0] == 1 and mel.shape[-1] == 80
    assert torch.isfinite(mel).all()
    try:
        model._waveform_to_log_mel(waveform, 44_100)
    except ValueError as exc:
        assert "24 kHz" in str(exc)
    else:
        raise AssertionError("non-24kHz audio must be rejected before preprocessing")


def test_image_and_video_paths_obey_fixed_64_by_64_and_four_frame_contract():
    model = V3Config().build_model().eval()
    image = torch.rand(1, 3, 121, 80)
    reconstruction, encoding = model.forward_image(image)
    assert reconstruction.shape == (1, 3, 64, 64)
    assert encoding.tokens.shape == (1, 64)

    video = torch.rand(1, 4, 3, 80, 120)
    chunks = list(model.forward_video_chunks(video, frame_chunk_size=2))
    assert [chunk.shape for chunk in chunks] == [(1, 2, 3, 64, 64), (1, 2, 3, 64, 64)]
    try:
        list(model.forward_video_chunks(torch.rand(1, 5, 3, 64, 64)))
    except ValueError as exc:
        assert "1..4 frames" in str(exc)
    else:
        raise AssertionError("more than four frames must be rejected")


def test_core_has_no_standalone_tldm_parameters_or_untied_text_head():
    model = V3Config().build_model()
    names = [name.lower() for name, _ in model.named_parameters()]
    assert not any("tldm" in name for name in names)
    assert model.lm_head.weight is model.token_embedding.weight
    assert len({id(parameter) for parameter in model.parameters()}) == len(list(model.parameters()))
