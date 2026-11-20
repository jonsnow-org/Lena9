from onecore.vocoder import neural_vocoder_placeholder
from onecore.android_perf import estimate_ram_mb

def test_vocoder():
    assert neural_vocoder_placeholder(2) == 512

def test_ram():
    assert estimate_ram_mb(57.6) == 230.4