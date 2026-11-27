from onecore.v3.flops import (
    block_flops, causal_forward_flops, joint_step_train_flops,
    lm_head_flops, micro_batch_forward_flops, micro_batch_train_flops,
    text_step_train_flops, tldm_forward_flops, build_v3_flops_report,
)
from onecore.v3 import V3Config


def test_corrected_spec_flops_exact_examples_at_128_and_512_tokens():
    assert block_flops(128) == 40_547_131_392
    assert causal_forward_flops(128) == 493_784_047_616
    assert tldm_forward_flops(128) == 372_437_367_296
    assert micro_batch_forward_flops(128) == 866_221_414_912
    assert micro_batch_train_flops(128) == 2_598_664_244_736
    assert joint_step_train_flops(128) == 12_993_321_223_680
    assert joint_step_train_flops(512) == 52_588_275_302_400
    assert text_step_train_flops(128) == 10_394_656_978_944
    assert lm_head_flops(128) == 1_346_691_072


def test_flops_report_uses_one_shared_body_and_explicit_zero_parameter_tldm():
    config = V3Config()
    report = build_v3_flops_report(config)
    assert report["config_sha256"] == config.fingerprint
    assert report["shared_block_applications"] == 12
    assert report["tldm_additional_trainable_parameters"] == 0
    assert report["paths"]["text"]["breakdown"]["native_tldm"]["tied_text_output_projection"] > 0
    assert report["joint_micro_batches_per_update"] == 5
    assert report["sequence_length_examples"]["128"]["joint_step_train_flops"] == 1_296_720_199_680
    assert report["sequence_length_examples"]["512"]["joint_step_train_flops"] == 5_258_827_530_240


def test_flops_input_validation_rejects_nonpositive_dimensions():
    try:
        block_flops(0)
    except ValueError as exc:
        assert "positive" in str(exc)
    else:
        raise AssertionError("zero-token FLOPs request must fail")
