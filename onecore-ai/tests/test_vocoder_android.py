from onecore.vocoder import NeuralVocoder
from onecore.android_perf import estimate_ram_mb
from onecore.training_loop import train_one_epoch

def test_vocoder_forward():
    v = NeuralVocoder(hidden=8)
    out = v.forward([0.1, 0.2])
    assert len(out) == 1

def test_training_loop():
    v = NeuralVocoder(hidden=8)
    data = [([0.1, 0.2], 0.5)]
    losses = train_one_epoch(v, data, epochs=2)
    assert len(losses) == 2

def test_ram():
    assert estimate_ram_mb(57.6, bits=32) > 0