import pytest

from onecore.v3 import V3Config
from onecore.v3.flops import build_v3_flops_report


def _tiny_config():
    return V3Config(
        text_vocab_size=64, width=32, layers=1, cycles=2,
        attention_heads=4, patch_size=4,
        audio_latent_channels=8, audio_hidden_channels=16,
        audio_codebook_size=16, audio_quantizer_stages=2,
        audio_channels=1, audio_sample_rate=24_000,
        temporal_layers=1, max_image_context_tokens=8,
        max_video_context_tokens=8, max_flow_context_tokens=8,
        temporal_window_frames=4, temporal_memory_frames=1,
        video_generation_chunk_frames=2,
    )


def _core_flops(batch, sequence, width, layers, cycles):
    per_layer = 24 * batch * sequence * width * width + 4 * batch * sequence * sequence * width
    return per_layer * layers * cycles


def test_v3_flops_counts_shared_recurrent_core_and_tied_text_projection():
    config = _tiny_config()
    report = build_v3_flops_report(
        config,
        batch_size=2,
        text_tokens=5,
        image_height=8,
        image_width=12,
        audio_samples=64,
        audio_sample_rate=24_000,
        video_frames=3,
        video_height=8,
        video_width=12,
        flow_steps=2,
    )
    text = report["paths"]["text"]["dense_flops"]
    base_text = _core_flops(2, 5, 32, 1, 2) + 2 * 2 * 5 * 32 * 64
    slots = min(config.tldm_latent_slots, 5)
    thinker = _core_flops(2, slots, 32, 1, 2)
    writer = _core_flops(2, slots + 5, 32, 1, 2)
    tied_head = 2 * 2 * 5 * 32 * 64
    expected = base_text + thinker + writer + tied_head
    tldm = report["paths"]["text"]["breakdown"]["native_tldm"]
    assert tldm["latent_thinker_shared_core"] == thinker
    assert tldm["diffusion_writer_shared_core"] == writer
    assert tldm["tied_text_output_projection"] == tied_head
    assert text == expected
    assert report["paths"]["tool"]["dense_flops"] == text
    assert report["paths"]["tool"]["same_path_as"] == "text"
    assert report["joint_five_family_forward_dense_flops"] == sum(
        report["paths"][name]["dense_flops"]
        for name in ("text", "tool", "image", "audio", "video")
    )
    assert report["scope"] == "forward arithmetic only; no backward pass or training loss"


def test_v3_flops_tracks_audio_latent_length_and_rejects_noncanonical_rate():
    config = _tiny_config()
    report = build_v3_flops_report(
        config, image_height=8, image_width=8, audio_samples=65,
        audio_sample_rate=24_000, video_frames=2, video_height=8, video_width=8,
    )
    # 65 samples are padded to 80; two stride-4 convolutions yield five latent steps.
    assert report["paths"]["audio"]["latent_tokens"] == 5
    assert report["paths"]["audio"]["breakdown"]["rvq_codebook_distance_matmuls"] == (
        2 * 1 * 5 * 8 * 16 * 2
    )
    with pytest.raises(ValueError, match="canonical"):
        build_v3_flops_report(
            config, audio_samples=64, audio_sample_rate=16_000,
            image_height=8, image_width=8, video_frames=2, video_height=8, video_width=8,
        )


def test_v3_flops_respects_video_chunk_memory_and_flow_context_caps():
    config = _tiny_config()
    report = build_v3_flops_report(
        config, image_height=8, image_width=8, audio_samples=64,
        video_frames=5, video_height=8, video_width=8, flow_steps=3,
    )
    video = report["paths"]["video"]["breakdown"]
    assert video["video_temporal_transformer"] > 0
    assert video["shared_recurrent_core"] > 0
    flow = report["flow_sampling"]["modalities"]["video"]
    assert flow["target_tokens"] == 2 * 4  # two generation frames, four spatial patches per frame
    assert flow["effective_target_tokens_after_context_cap"] <= config.max_flow_context_tokens
    assert flow["sampling_dense_flops"] == flow["per_step_dense_flops"] * 3


def test_v3_flops_rejects_model_config_mismatch_and_invalid_shapes():
    config = _tiny_config()
    different = V3Config(**{**config.to_dict(), "width": 64, "attention_heads": 4})
    model = config.build_model()
    with pytest.raises(ValueError, match="model/config mismatch"):
        build_v3_flops_report(different, model=model)
    with pytest.raises(ValueError, match="positive"):
        build_v3_flops_report(config, text_tokens=0)
