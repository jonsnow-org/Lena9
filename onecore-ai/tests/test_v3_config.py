from onecore.v3 import V3Config


def tiny_config(**overrides):
    values = {
        "architecture_version": "onecore-v3-test-fixture",
        "width": 32,
        "unique_blocks": 1,
        "recurrent_cycles": 2,
        "attention_heads": 4,
        "max_sequence_length": 128,
        "text_vocab_size": 64,
        "vision_codebook_size": 16,
        "audio_codebook_size": 8,
        "motion_codebook_size": 8,
        "special_tokens": 24,
        "patch_size": 8,
        "image_size": 32,
        "audio_bins": 8,
        "audio_group_frames": 2,
        "audio_sample_rate": 24_000,
        "audio_channels": 1,
        "max_video_frames": 4,
        "tldm_latent_slots": 4,
        "dropout": 0.0,
    }
    values.update(overrides)
    return V3Config(**values)


def test_canonical_configuration_is_exactly_the_corrected_pdf_model():
    config = V3Config()
    assert config.is_canonical
    assert config.width == 1024
    assert config.unique_blocks == 4
    assert config.recurrent_cycles == 3
    assert config.attention_heads == 8
    assert config.hidden_size == 2730
    assert config.vocab_size == 5144
    assert config.max_sequence_length == 512
    assert config.tldm_latent_slots == 16
    assert config.fingerprint == V3Config(**config.to_dict()).fingerprint


def test_canonical_model_parameter_count_and_tldm_share_weights():
    model = V3Config().build_model()
    assert model.count_parameters() == 57_579_201
    assert model.lm_head.weight is model.token_embedding.weight
    assert model.parameter_report()["tldm_additional_trainable_parameters"] == 0
    assert len(model.blocks) == 4


def test_test_fixture_is_explicitly_noncanonical_and_fingerprinted():
    config = tiny_config()
    first = config.parameter_report()
    second = config.parameter_report()
    assert not config.is_canonical
    assert first == second
    assert len(config.fingerprint) == 64
    assert first["config_sha256"] == config.fingerprint
    assert config.vocab_size == 120
