import torch

from onecore.v3.losses import (
    ImagePatchDiscriminator,
    MultiScaleAudioDiscriminator,
    audio_multiresolution_stft_loss,
    discriminator_hinge_loss,
    generator_hinge_loss,
    image_pyramid_reconstruction_loss,
    symmetric_cross_modal_alignment_loss,
    video_temporal_consistency_loss,
)


def test_v3_image_pyramid_and_patch_adversarial_losses_have_gradients():
    real = torch.rand(2, 3, 64, 48)
    fake = torch.rand(2, 3, 64, 48, requires_grad=True)
    reconstruction = image_pyramid_reconstruction_loss(fake, real)
    discriminator = ImagePatchDiscriminator(base_channels=8)
    real_scores = discriminator(real)
    fake_scores = discriminator(fake)
    objective = reconstruction + generator_hinge_loss(fake_scores)
    (objective + discriminator_hinge_loss(real_scores, fake_scores)).backward()
    assert torch.isfinite(objective)
    assert fake.grad is not None
    assert discriminator.network[0].weight.grad is not None


def test_v3_multiresolution_audio_and_multiscale_adversarial_losses():
    real = torch.randn(2, 2048)
    fake = torch.randn(2, 2048, requires_grad=True)
    reconstruction = audio_multiresolution_stft_loss(fake, real, fft_sizes=(128, 256, 512))
    discriminator = MultiScaleAudioDiscriminator(base_channels=4, scales=2)
    real_scores = discriminator(real)
    fake_scores = discriminator(fake)
    objective = reconstruction + generator_hinge_loss(fake_scores)
    (objective + discriminator_hinge_loss(real_scores, fake_scores)).backward()
    assert torch.isfinite(objective)
    assert fake.grad is not None


def test_v3_video_temporal_and_cross_modal_alignment_losses():
    real_video = torch.rand(2, 4, 3, 32, 32)
    fake_video = torch.rand(2, 4, 3, 32, 32, requires_grad=True)
    temporal = video_temporal_consistency_loss(fake_video, real_video)
    left = torch.randn(4, 16, requires_grad=True)
    right = torch.randn(4, 16, requires_grad=True)
    alignment = symmetric_cross_modal_alignment_loss(left, right)
    (temporal + alignment).backward()
    assert torch.isfinite(temporal)
    assert torch.isfinite(alignment)
    assert fake_video.grad is not None
    assert left.grad is not None
