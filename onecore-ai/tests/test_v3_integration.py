import torch

from onecore.v3.core import MASK

def tiny_config(**overrides):
    values = dict(architecture_version="onecore-v3-test-fixture", width=32, unique_blocks=1,
                  recurrent_cycles=2, attention_heads=4, max_sequence_length=128,
                  text_vocab_size=64, vision_codebook_size=16, audio_codebook_size=8,
                  motion_codebook_size=8, special_tokens=24, patch_size=8, image_size=32,
                  audio_bins=8, audio_group_frames=2, audio_sample_rate=24000,
                  audio_channels=1, max_video_frames=4, tldm_latent_slots=4, dropout=0.0)
    values.update(overrides)
    return V3Config(**values)


def test_one_model_uses_one_shared_transformer_for_all_five_family_representations():
    torch.manual_seed(23)
    model = tiny_config().build_model()
    text = torch.randint(0, model.cfg.text_vocab_size, (2, 11))
    text_logits = model.forward_text(text)
    assert text_logits.shape == (2, 11, model.cfg.vocab_size)

    image, image_state = model.forward_image(torch.rand(1,3,31,41))
    assert image.shape == (1,3,32,32) and image_state.tokens.shape == (1,16)
    mel, audio_state = model.forward_audio(torch.rand(1,2048), sample_rate=24000)
    assert mel.ndim == 3 and mel.shape[-1] == model.cfg.audio_bins
    assert audio_state.tokens.shape[0] == 1
    video = torch.rand(1,4,3,32,32)
    decoded = torch.cat(list(model.forward_video_chunks(video, frame_chunk_size=2)), dim=1)
    assert decoded.shape == (1,4,3,32,32)

    (text_logits.square().mean()+image.square().mean()+mel.square().mean()+decoded.square().mean()).backward()
    assert model.blocks[0].attn.qkv.weight.grad is not None
    assert model.image_encoder.weight.grad is not None
    assert model.audio_encoder.weight.grad is not None


def test_native_tldm_reuses_same_blocks_embeddings_and_tied_output_projection():
    torch.manual_seed(37)
    model = tiny_config().build_model().eval()
    ids = torch.randint(0,64,(2,12))
    masked = ids.clone(); masked[:,3:7] = model.cfg.special_id(MASK)
    changed = masked.clone()
    before = model.count_parameters()
    with torch.no_grad():
        first = model.forward_tldm(masked, latent_slots=4)
        second = model.forward_tldm(changed, latent_slots=4)
    assert first.shape == (2,12,model.cfg.vocab_size)
    assert torch.allclose(first,second,atol=1e-6,rtol=1e-6)
    assert model.count_parameters() == before
    assert model.lm_head.weight is model.token_embedding.weight


def test_model_rejects_sequences_longer_than_the_configured_context():
    model = tiny_config().build_model()
    try:
        model.forward_text(torch.zeros(1,129,dtype=torch.long))
    except ValueError as exc:
        assert "maximum length" in str(exc)
    else:
        raise AssertionError("overlong input must be rejected")
