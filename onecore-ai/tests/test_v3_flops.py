from onecore.v3.flops import (
    block_flops, causal_forward_flops, joint_step_train_flops, lm_head_flops,
    micro_batch_forward_flops, micro_batch_train_flops, text_step_train_flops,
    tldm_forward_flops, build_v3_flops_report,
)
from onecore.v3 import V3Config


def test_exact_flops_formula_examples_at_128_and_512_tokens():
    assert block_flops(128) == 3_287_810_048
    assert lm_head_flops(128) == 1_348_468_736
    assert causal_forward_flops(128) == 40_802_189_312
    assert tldm_forward_flops(128) == 45_645_824_000
    assert micro_batch_forward_flops(128) == 86_448_013_312
    assert micro_batch_train_flops(128) == 259_344_039_936
    assert joint_step_train_flops(128) == 1_296_720_199_680
    assert text_step_train_flops(128) == 1_037_376_159_744
    assert joint_step_train_flops(512) == 5_258_827_530_240


def test_flops_report_binds_to_one_canonical_config_and_native_tldm():
    cfg = V3Config()
    report = build_v3_flops_report(cfg)
    assert report["config_sha256"] == cfg.fingerprint
    assert report["shared_block_applications"] == 12
    assert report["tldm_additional_trainable_parameters"] == 0
    assert report["paths"]["text"]["breakdown"]["native_tldm"]["tied_text_output_projection"] > 0
    assert report["joint_micro_batches_per_update"] == 5
    assert report["sequence_length_examples"]["128"]["joint_step_train_flops"] == 1_296_720_199_680
    assert report["sequence_length_examples"]["512"]["joint_step_train_flops"] == 5_258_827_530_240


def test_flops_formula_rejects_invalid_dimensions():
    try:
        block_flops(0)
    except ValueError as exc:
        assert "positive" in str(exc)
    else:
        raise AssertionError("zero-token FLOPs request must fail")
