import pytest

from onecore.flops import (
    block_flops,
    joint_step_train_flops,
    text_step_train_flops,
)


@pytest.mark.parametrize(
    ("seq_len", "expected"),
    [
        (64, 1_627_127_808),
        (128, 3_287_810_048),
        (256, 6_709_837_824),
        (512, 13_956_546_560),
    ],
)
def test_block_flops_match_corrected_spec_v2(seq_len, expected):
    assert block_flops(seq_len) == expected


def test_joint_and_text_micro_batch_counts_are_distinct():
    assert joint_step_train_flops(128) == 1_296_720_199_680
    assert text_step_train_flops(128) == 1_037_376_159_744


def test_invalid_flops_dimensions_are_rejected():
    with pytest.raises(ValueError, match="positive"):
        block_flops(0)
