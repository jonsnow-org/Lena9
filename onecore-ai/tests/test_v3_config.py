from onecore.v3 import V3Config


def tiny_config(**overrides):
    values = dict(architecture_version="onecore-v3-test-fixture", width=32, unique_blocks=1,
                  recurrent_cycles=2, attention_heads=4, max_sequence_length=128,
                  text_vocab_size=64, vision_codebook_size=16, audio_codebook_size=8,
                  motion_codebook_size=8, special_tokens=24, patch_size=8, image_size=32,
                  audio_bins=8, audio_group_frames=2, audio_sample_rate=24000,
                  audio_channels=1, max_video_frames=4, tldm_latent_slots=4, dropout=0.0)
    values.update(overrides)
    return V3Config(**values)


def test_canonical_configuration_matches_corrected_spec():
    cfg = V3Config()
    assert cfg.is_canonical
    assert (cfg.width, cfg.unique_blocks, cfg.recurrent_cycles, cfg.attention_heads) == (1024,4,3,8)
    assert (cfg.hidden_size, cfg.vocab_size, cfg.max_sequence_length, cfg.tldm_latent_slots) == (2730,5144,512,16)
    assert cfg.fingerprint == V3Config(**cfg.to_dict()).fingerprint


def test_canonical_model_parameter_count_and_tied_tldm_head_are_exact():
    model = V3Config().build_model()
    assert model.count_parameters() == 57_579_201
    assert model.lm_head.weight is model.token_embedding.weight
    assert model.parameter_report()["tldm_additional_trainable_parameters"] == 0
    assert len(model.blocks) == 4


def test_small_test_fixture_is_not_mistaken_for_canonical_model():
    cfg = tiny_config()
    assert not cfg.is_canonical
    assert cfg.fingerprint == V3Config(**cfg.to_dict()).fingerprint
    report = cfg.parameter_report()
    assert report["parameters"] == cfg.build_model().count_parameters()
