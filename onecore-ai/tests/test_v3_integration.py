import torch

from onecore.v3 import OneCoreV3


def _tiny_v3():
    return OneCoreV3(
        text_vocab_size=128, width=32, layers=1, attention_heads=4,
        patch_size=8, audio_latent_channels=16, audio_hidden_channels=24,
        audio_codebook_size=32, audio_quantizer_stages=3,
        temporal_layers=1, max_image_context_tokens=16, max_video_context_tokens=16,
        max_flow_context_tokens=16, temporal_window_frames=8, temporal_memory_frames=2,
        video_generation_chunk_frames=4, dropout=0.0,
    )


def test_v3_shared_core_integrates_text_image_audio_and_video():
    torch.manual_seed(23)
    model = _tiny_v3()
    text = torch.randint(0, 128, (2, 11))
    image = torch.rand(1, 3, 32, 48)
    audio = torch.rand(1, 2049)
    video = torch.rand(1, 5, 3, 32, 32)
    timestamps = torch.tensor([[0.0, 0.1, 0.25, 0.4, 0.8]])

    text_logits = model.forward_text(text)
    observed_core_lengths = []
    hook = model.shared_core.register_forward_pre_hook(
        lambda _module, args: observed_core_lengths.append(args[0].shape[1])
    )
    image_reconstruction, image_state = model.forward_image(image)
    hook.remove()
    assert observed_core_lengths[0] <= 16
    audio_reconstruction, audio_state = model.forward_audio(audio)
    video_reconstruction, video_state = model.forward_video(video, timestamps)

    assert text_logits.shape == (2, 11, 128)
    assert image_reconstruction.shape == image.shape
    assert image_state.tokens.shape == (1, 24, 32)
    assert audio_reconstruction.shape == audio.shape
    assert audio_state.codes.shape[0] == 1
    assert video_reconstruction.shape == video.shape
    assert video_state.frame_count == 5

    objective = (
        text_logits.square().mean()
        + image_reconstruction.square().mean()
        + audio_reconstruction.square().mean()
        + audio_state.commitment_loss
        + video_reconstruction.square().mean()
    )
    objective.backward()
    assert model.shared_core.layers.layers[0].self_attn.in_proj_weight.grad is not None
    assert model.image_codec.encoder.weight.grad is not None
    assert model.audio_codec.encoder[0].weight.grad is not None
    assert model.video_codec.temporal.layers[0].self_attn.in_proj_weight.grad is not None



def test_v3_flow_matching_and_variable_shape_generation_paths():
    torch.manual_seed(29)
    model = _tiny_v3()
    clean = torch.randn(2, 7, 32)
    condition = model.text_condition(torch.randint(0, 128, (2, 5)))
    loss = model.flow_matching_loss(clean, modality=1, condition_tokens=condition)
    loss.backward()
    assert torch.isfinite(loss)
    assert model.flow_velocity_head.weight.grad is not None

    with torch.no_grad():
        image = model.generate_image(31, 47, condition_ids=torch.randint(0, 128, (1, 4)), steps=2)
        audio = model.generate_audio(1001, condition_ids=torch.randint(0, 128, (1, 4)), steps=2)
        video = model.generate_video(
            13, 31, 47, condition_ids=torch.randint(0, 128, (1, 4)), steps=2, chunk_frames=4
        )

    assert image.shape == (1, 3, 31, 47)
    assert audio.shape == (1, 1, 1001)
    assert video.shape == (1, 13, 3, 31, 47)
