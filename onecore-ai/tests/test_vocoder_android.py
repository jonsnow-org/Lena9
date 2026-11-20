from onecore.vocoder import NeuralVocoder
from onecore.android_perf import estimate_ram_mb, estimate_latency_ms
from onecore.training_loop import train_one_epoch
from onecore.quantization import quantize_tensor

def test_vocoder_forward_backward():
    v = NeuralVocoder(in_dim=4, hidden=8, out_dim=1)
    x = [0.1, 0.2, 0.3, 0.4]
    y = [0.5]
    out = v.forward(x)
    assert len(out) == 1
    loss = v.backward(x, y)
    assert loss >= 0.0

def test_training_loop_checkpoint(tmp_path):
    v = NeuralVocoder(in_dim=4, hidden=8, out_dim=1)
    data = [([0.1, 0.2, 0.3, 0.4], [0.5])]
    losses = train_one_epoch(v, data, epochs=2, checkpoint_dir=str(tmp_path))
    assert len(losses) == 2
    assert (tmp_path / "ckpt_epoch_1.json").exists()

def test_ram_latency():
    assert estimate_ram_mb(57.6) > 0
    assert estimate_latency_ms(57.6) > 0

def test_quantization():
    assert quantize_tensor([0.0, 0.5, 1.0], bits=4) == [0, 7, 15]