from onecore.scaling import scaled_config

def test_scaled():
    cfg = scaled_config(512, 2, 2)
    assert cfg.width == 512
    assert cfg.unique_blocks == 2