from onecore.v3 import V3Config


def test_v3_config_fingerprint_and_parameter_report_are_deterministic():
    config = V3Config(
        text_vocab_size=128, width=32, layers=1, cycles=3, attention_heads=4,
        patch_size=8, audio_latent_channels=16, audio_hidden_channels=24,
        audio_codebook_size=32, audio_quantizer_stages=3,
        temporal_layers=1, dropout=0.0,
    )
    first = config.parameter_report()
    second = config.parameter_report()

    assert config.fingerprint == V3Config(**config.to_dict()).fingerprint
    assert len(config.fingerprint) == 64
    assert first == second
    assert first["architecture_version"] == "onecore-v3-prototype-2"
    assert config.tldm_latent_slots == 16
    assert first["trainable_parameters"] > 0
