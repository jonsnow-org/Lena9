from types import SimpleNamespace

import pytest
import torch

from onecore.v3.config import V3Config
from onecore.v3.core import MASK
from onecore.v3.training import OneCoreV3Objective, V3ObjectiveWeights, train_v3_joint_step, train_v3_step

def tiny_config(**overrides):
    values = dict(architecture_version="onecore-v3-test-fixture", width=32, unique_blocks=1,
                  recurrent_cycles=2, attention_heads=4, max_sequence_length=128,
                  text_vocab_size=64, vision_codebook_size=16, audio_codebook_size=8,
                  motion_codebook_size=8, special_tokens=24, patch_size=8, image_size=32,
                  audio_bins=8, audio_group_frames=2, audio_sample_rate=24000,
                  audio_channels=1, max_video_frames=4, tldm_latent_slots=4, dropout=0.0)
    values.update(overrides)
    return V3Config(**values)


def _micro_batches():
    return (
        SimpleNamespace(family="text", batch={"text":{"input_ids":torch.randint(0,64,(1,12))}}),
        SimpleNamespace(family="tool", batch={"tool":{"input_ids":torch.randint(0,64,(1,12))}}),
        SimpleNamespace(family="image", batch={"image":{"images":torch.rand(1,3,32,32),"condition_ids":torch.randint(0,64,(1,8))}}),
        SimpleNamespace(family="audio", batch={"audio":{"waveform":torch.randn(1,2048),"sample_rate":24000,"condition_ids":torch.randint(0,64,(1,8))}}),
        SimpleNamespace(family="video", batch={"video":{"frames":torch.rand(1,4,3,32,32),"condition_ids":torch.randint(0,64,(1,8))}}),
    )


def test_shared_objective_produces_language_codec_and_tldm_losses_for_each_family():
    torch.manual_seed(31)
    model=tiny_config().build_model()
    objective=OneCoreV3Objective(model,V3ObjectiveWeights())
    for item in _micro_batches():
        losses=objective(item.batch)
        assert set(losses)=={"language_loss","aux_loss","tldm_loss","total"}
        assert all(torch.isfinite(value) for value in losses.values())
        assert losses["language_loss"]>0 and losses["tldm_loss"]>=0


def test_joint_step_accumulates_five_families_and_runs_one_optimizer_update():
    torch.manual_seed(71)
    model=tiny_config().build_model(); optimizer=torch.optim.AdamW(model.parameters(),lr=1e-4)
    before=[p.detach().clone() for p in model.parameters()]
    metrics=train_v3_joint_step(model,optimizer,_micro_batches())
    assert metrics["optimizer_updates"]==1.0 and metrics["family_micro_batches"]==5.0
    assert metrics["total"]>0 and metrics["gradient_norm"]>0
    assert all(f"{f}/total" in metrics for f in ("text","tool","image","audio","video"))
    assert any(not torch.equal(a,b) for a,b in zip(before,model.parameters(),strict=True))


def test_joint_step_rejects_missing_or_reordered_microbatches_without_update():
    model=tiny_config().build_model(); optimizer=torch.optim.AdamW(model.parameters(),lr=1e-4)
    before=[p.detach().clone() for p in model.parameters()]
    incomplete=(SimpleNamespace(family="text",batch={"text":{}}),)
    with pytest.raises(ValueError,match="exactly text/tool/image/audio/video"):
        train_v3_joint_step(model,optimizer,incomplete)
    reordered=tuple(SimpleNamespace(family=f,batch={f:{}}) for f in ("tool","text","image","audio","video"))
    with pytest.raises(ValueError,match="exactly text/tool/image/audio/video"):
        train_v3_joint_step(model,optimizer,reordered)
    assert all(torch.equal(a,b) for a,b in zip(before,model.parameters(),strict=True))


def test_tldm_masks_shared_vocab_tokens_without_dedicated_trainable_parameters():
    model=tiny_config().build_model()
    ids=torch.randint(0,64,(1,12)); ids[:,4:8]=model.cfg.special_id(MASK)
    logits=model.forward_tldm(ids,latent_slots=4)
    assert logits.shape==(1,12,model.cfg.vocab_size)
    assert model.lm_head.weight is model.token_embedding.weight
    assert not any("tldm" in name.lower() for name,_ in model.named_parameters())


def test_single_family_smoke_step_remains_distinct_from_five_family_production_update():
    model=tiny_config().build_model(); optimizer=torch.optim.AdamW(model.parameters(),lr=1e-4)
    metrics=train_v3_step(model,optimizer,{"text":{"input_ids":torch.randint(0,64,(1,8))}})
    assert metrics["optimizer_updates"]==1.0 and metrics["total"]>0
