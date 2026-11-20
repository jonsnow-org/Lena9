from onecore.quantization import quantize_tensor

def test_quantize():
    out = quantize_tensor([0.0, 0.5, 1.0], bits=4)
    assert out == [0, 7, 15]