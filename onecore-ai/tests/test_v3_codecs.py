import torch

from onecore.v3 import NeuralAudioCodec, TemporalVideoCodec, VariableResolutionImageCodec


def test_v3_image_codec_preserves_variable_resolution_and_aspect_ratio():
    codec = VariableResolutionImageCodec(width=32, patch_size=8)
    portrait = torch.rand(2, 3, 64, 32, requires_grad=True)
    landscape = torch.rand(1, 3, 32, 96)

    portrait_reconstruction, portrait_encoding = codec(portrait)
    landscape_reconstruction, landscape_encoding = codec(landscape)

    assert portrait_encoding.tokens.shape == (2, 32, 32)
    assert portrait_reconstruction.shape == portrait.shape
    assert landscape_encoding.tokens.shape == (1, 48, 32)
    assert landscape_reconstruction.shape == landscape.shape
    portrait_reconstruction.square().mean().backward()
    assert portrait.grad is not None
    assert torch.isfinite(portrait.grad).all()


def test_v3_image_codec_preserves_arbitrary_native_dimensions():
    codec = VariableResolutionImageCodec(width=32, patch_size=8)
    image = torch.rand(1, 3, 63, 47)
    reconstruction, encoding = codec(image)
    assert encoding.grid_height == 8
    assert encoding.grid_width == 6
    assert reconstruction.shape == image.shape


def test_v3_neural_audio_codec_handles_variable_duration_and_exact_length():
    torch.manual_seed(7)
    codec = NeuralAudioCodec(
        latent_channels=16, hidden_channels=24, codebook_size=32, quantizer_stages=3
    )
    for samples in (257, 1024, 4097):
        waveform = torch.randn(2, samples, requires_grad=True)
        reconstruction, encoding = codec(waveform, sample_rate=24_000)
        assert reconstruction.shape == waveform.shape
        assert encoding.codes.shape[:2] == (2, 3)
        assert encoding.quantized.shape[1] == 16
        assert torch.isfinite(encoding.commitment_loss)
        loss = (reconstruction - waveform).abs().mean() + encoding.commitment_loss
        loss.backward()
        assert waveform.grad is not None
        assert torch.isfinite(waveform.grad).all()
        codec.zero_grad(set_to_none=True)


def test_v3_video_codec_keeps_all_frames_and_variable_timestamps():
    codec = TemporalVideoCodec(
        width=32, patch_size=8, temporal_layers=1, attention_heads=4
    ).eval()
    video = torch.rand(1, 37, 3, 32, 48)
    timestamps = torch.arange(37, dtype=torch.float32).unsqueeze(0) / 24.0

    chunks = list(codec.iter_encode(video, timestamps=timestamps))
    assert [chunk.frame_count for chunk in chunks] == [32, 5]
    with torch.no_grad():
        reconstruction, encoding = codec(video, timestamps=timestamps)

    assert encoding.frame_count == 37
    assert encoding.tokens.shape == (1, 37, 24, 32)
    assert torch.equal(encoding.timestamps, timestamps)
    assert reconstruction.shape == video.shape


def test_v3_video_temporal_attention_is_causal():
    torch.manual_seed(19)
    codec = TemporalVideoCodec(
        width=32, patch_size=8, temporal_layers=1, attention_heads=4
    ).eval()
    original = torch.rand(1, 5, 3, 32, 32)
    changed_future = original.clone()
    changed_future[:, -1] = torch.rand_like(changed_future[:, -1])

    with torch.no_grad():
        first = codec.encode(original)
        second = codec.encode(changed_future)

    assert torch.allclose(first.tokens[:, :-1], second.tokens[:, :-1], atol=1e-6, rtol=1e-6)


def test_v3_audio_codec_preserves_stereo_channels_and_sample_rate_metadata():
    torch.manual_seed(43)
    codec = NeuralAudioCodec(
        latent_channels=16, hidden_channels=24, codebook_size=32,
        quantizer_stages=3, channels=2,
    )
    stereo = torch.randn(2, 2, 2049)
    reconstructed, encoding = codec(stereo, sample_rate=24_000)
    assert reconstructed.shape == stereo.shape
    assert encoding.original_channels == 2
    assert encoding.sample_rate is None

    mono = torch.randn(1, 1025)
    mono_encoding = codec.encode(mono, sample_rate=24_000)
    mono_reconstruction = codec.decode(mono_encoding)
    assert mono_reconstruction.shape == (1, 1, 1025)
    assert mono_encoding.original_channels == 1
    assert mono_encoding.sample_rate == 24_000


def test_v3_audio_codec_rejects_invalid_sample_rate_and_channel_count():
    import pytest
    codec = NeuralAudioCodec(latent_channels=8, hidden_channels=16,
                             codebook_size=16, quantizer_stages=2, channels=2)
    with pytest.raises(ValueError, match="sample_rate"):
        codec.encode(torch.randn(1, 1024), sample_rate=0)
    with pytest.raises(ValueError, match="waveform"):
        codec.encode(torch.randn(1, 3, 1024), sample_rate=24_000)
    with pytest.raises(ValueError, match="resampled"):
        codec.encode(torch.randn(1, 1024), sample_rate=44_100)
    with pytest.raises(ValueError, match="mono.*stereo"):
        NeuralAudioCodec(latent_channels=8, hidden_channels=16,
                         codebook_size=16, quantizer_stages=2, channels=3)
