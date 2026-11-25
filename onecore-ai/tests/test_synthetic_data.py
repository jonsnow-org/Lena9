from onecore.synthetic_data import generate_text_samples, generate_image_patches

def test_text_samples():
    s = generate_text_samples(3)
    assert len(s) == 3
    assert "+" in s[0]

def test_image_patches():
    p = generate_image_patches(2)
    assert len(p) == 2