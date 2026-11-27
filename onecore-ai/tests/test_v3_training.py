from types import SimpleNamespace

import pytest
import torch

from onecore.v3 import V3Config
from onecore.v3.core import MASK
from onecore.v3.training import OneCoreV3Objective, V3ObjectiveWeights, train_v3_joint_step, train_v3_step
from .test_v3_config import tiny_config


def _family_batches():
    config = tiny_config()
    return config, (
        SimpleNamespace(family="text", batch={"text": {"input_ids": torch.randint(0,64,(1,12))}}),
        SimpleNamespace(family="tool", batch={"tool": {"input_ids": torch.randint(0,64,(1,12))}}),
        SimpleNamespace(family="image", batch={"image": {"images": torch.rand(1,3,32,32), "condition_ids": torch.randint(0,64,(1,8))}}),
        SimpleNamespace(family="audio", batch={"audio": {"waveform": torch.randn(1,2048), "sample_rate":24000, "condition_ids":torch.randint(0,64,(1,8))}}),
        SimpleNamespace(family="video", batch={"video": {"frames": torch.rand(1,4,3,32,32), "condition_ids":torch.randint(0,64,(1,8))}}),
    )


def test_corrected_objective_builds_shared_vocabulary_losses_for_all_families():
    torch.manual_seed(31)
    config, batches = _family_batches()
    model = config.build_model()
    objective = OneCoreV3Objective(model, V3ObjectiveWeights())
    for item in batches:
        result = objective(item.batch)
        assert set(result) == {"language_loss", "aux_loss", "tldm_loss", "total"}
        assert all(torch.isfinite(value) for value in result.values())
        assert result["language_loss"] > 0
        assert result["tldm_loss"] >= 0


def test_one_joint_update_contains_exactly_five_ordered_family_microbatches():
    torch.manual_seed(71)
    config, batches = _family_batches()
    model = config.build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    before = [parameter.detach().clone() for parameter in model.parameters()]
    metrics = train_v3_joint_step(model, optimizer, batches)
    assert metrics["optimizer_updates"] == 1.0
    assert metrics["family_micro_batches"] == 5.0
    assert metrics["total"] > 0 and metrics["gradient_norm"] > 0
    assert all(f"{family}/total" in metrics for family in ("text","tool","image","audio","video"))
    assert any(not torch.equal(old, new) for old,new in zip(before,model.parameters(),strict=True))


def test_joint_step_rejects_missing_or_reordered_families_without_updating():
    model = tiny_config().build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    before = [parameter.detach().clone() for parameter in model.parameters()]
    incomplete = (SimpleNamespace(family="text",batch={"text":{}}),)
    with pytest.raises(ValueError, match="exactly text/tool/image/audio/video"):
        train_v3_joint_step(model, optimizer, incomplete)
    reordered = tuple(SimpleNamespace(family=f,batch={f:{}}) for f in ("tool","text","image","audio","video"))
    with pytest.raises(ValueError, match="exactly text/tool/image/audio/video"):
        train_v3_joint_step(model, optimizer, reordered)
    assert all(torch.equal(a,b) for a,b in zip(before,model.parameters(),strict=True))


def test_tldm_uses_masked_shared_tokens_and_no_separate_parameter_tower():
    model = tiny_config().build_model()
    ids = torch.randint(0,64,(1,12))
    masked = ids.clone(); masked[:,4:8] = model.cfg.special_id(MASK)
    logits = model.forward_tldm(masked, latent_slots=4)
    assert logits.shape == (1,12,model.cfg.vocab_size)
    assert model.lm_head.weight is model.token_embedding.weight
    assert not any("tldm" in name.lower() for name,_ in model.named_parameters())


def test_single_family_step_is_separate_from_joint_update_contract():
    model = tiny_config().build_model()
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
    metrics = train_v3_step(model, optimizer, {"text":{"input_ids":torch.randint(0,64,(1,8))}})
    assert metrics["optimizer_updates"] == 1.0
    assert metrics["total"] > 0
