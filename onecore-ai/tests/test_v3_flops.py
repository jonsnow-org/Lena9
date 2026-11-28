from onecore.v3.flops import (
    block_flops, causal_forward_flops, joint_step_train_flops, lm_head_flops,
    micro_batch_forward_flops, micro_batch_train_flops, text_step_train_flops,
    tldm_forward_flops, build_v3_flops_report,
)
from onecore.v3 import V3Config


def test_exact_flops_formula_examples_at_128_and_512_tokens():
    assert block_flops(128) == 3_287_810_048
    assert lm_head_flops(128) == 8_663_334_912
    assert causal_forward_flops(128) == 48_117_055_488
    assert tldm_forward_flops(128) == 52_960_690_176
    assert micro_batch_forward_flops(128) == 101_077_745_664
    assert micro_batch_train_flops(128) == 303_233_236_992
    assert joint_step_train_flops(128) == 1_516_166_184_960
    assert text_step_train_flops(128) == 1_212_932_947_968
    assert joint_step_train_flops(512) == 6_136_611_471_360


def test_flops_report_binds_to_one_canonical_config_and_native_tldm():
    cfg = V3Config()
    report = build_v3_flops_report(cfg)
    assert report["config_sha256"] == cfg.fingerprint
    assert report["shared_block_applications"] == 12
    assert report["tldm_additional_trainable_parameters"] == 0
    assert report["paths"]["text"]["breakdown"]["native_tldm"]["tied_text_output_projection"] > 0
    assert report["joint_micro_batches_per_update"] == 5
    assert report["sequence_length_examples"]["128"]["joint_step_train_flops"] == 1_516_166_184_960
    assert report["sequence_length_examples"]["512"]["joint_step_train_flops"] == 6_136_611_471_360


def test_flops_helpers_bind_output_projection_to_supplied_config():
    tiny = V3Config(architecture_version="onecore-v3-test-fixture", width=32,
                    unique_blocks=1, recurrent_cycles=2, attention_heads=4,
                    max_sequence_length=128, text_vocab_size=64,
                    vision_codebook_size=16, audio_codebook_size=8,
                    motion_codebook_size=8, special_tokens=24, patch_size=8,
                    image_size=32, audio_bins=8, audio_group_frames=2,
                    audio_sample_rate=24000, audio_channels=1,
                    max_video_frames=4, tldm_latent_slots=4, dropout=0.0)
    assert lm_head_flops(7, tiny.vocab_size, tiny.width) == 2 * 7 * tiny.vocab_size * tiny.width
    assert joint_step_train_flops(32, tiny) < joint_step_train_flops(32, V3Config())


def test_flops_formula_rejects_invalid_dimensions():
    try:
        block_flops(0)
    except ValueError as exc:
        assert "positive" in str(exc)
    else:
        raise AssertionError("zero-token FLOPs request must fail")
