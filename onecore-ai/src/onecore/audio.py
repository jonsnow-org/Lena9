from __future__ import annotations

import math

import torch
from torch.nn import functional as F


def log_mel_spectrogram(waveform: torch.Tensor, sample_rate: int = 16000,
                        n_fft: int = 400, hop_length: int = 160,
                        n_mels: int = 80) -> torch.Tensor:
    """Dependency-light log-mel features for preparing licensed WAV files."""
    if waveform.ndim != 1:
        raise ValueError("waveform must be mono [samples]")
    window = torch.hann_window(n_fft, device=waveform.device)
    spectrum = torch.stft(waveform.float(), n_fft=n_fft, hop_length=hop_length,
                          window=window, return_complex=True).abs().pow(2)
    frequencies = torch.linspace(0, sample_rate / 2, spectrum.shape[0], device=waveform.device)
    mel_min = 2595.0 * math.log10(1.0)
    mel_max = 2595.0 * math.log10(1.0 + (sample_rate / 2) / 700.0)
    mel_points = torch.linspace(mel_min, mel_max, n_mels + 2, device=waveform.device)
    hz_points = 700.0 * (torch.pow(10.0, mel_points / 2595.0) - 1.0)
    filters = []
    for i in range(n_mels):
        left, center, right = hz_points[i:i + 3]
        up = (frequencies - left) / (center - left).clamp_min(1e-6)
        down = (right - frequencies) / (right - center).clamp_min(1e-6)
        filters.append(torch.minimum(up, down).clamp(0, 1))
    bank = torch.stack(filters)
    mel = bank @ spectrum
    return torch.log(mel.clamp_min(1e-8)).transpose(0, 1).contiguous()


def save_log_mel_npy(waveform_path: str, output_path: str, sample_rate: int = 16000) -> None:
    import wave
    import numpy as np

    with wave.open(waveform_path, "rb") as wav:
        channels, width, rate, frames = wav.getnchannels(), wav.getsampwidth(), wav.getframerate(), wav.getnframes()
        if width != 2:
            raise ValueError("only 16-bit PCM WAV is supported by this preparation helper")
        raw = wav.readframes(frames)
    data = np.frombuffer(raw, dtype="<i2").astype("float32") / 32768.0
    if channels > 1:
        data = data.reshape(-1, channels).mean(axis=1)
    tensor = torch.from_numpy(data)
    features = log_mel_spectrogram(tensor, sample_rate=rate)
    np.save(output_path, features.numpy().astype("float32"))



def log_mel_to_waveform(log_mel: torch.Tensor, sample_rate: int = 16000,
                        n_fft: int = 400, hop_length: int = 160,
                        n_iter: int = 24, seed: int = 0) -> torch.Tensor:
    """Approximate waveform reconstruction with a pseudoinverse mel bank + Griffin-Lim.

    This is a deterministic, dependency-light decoder for research smoke tests.
    It is not a learned neural vocoder and should not be presented as production
    speech/music quality.
    """
    if log_mel.ndim != 2 or log_mel.shape[1] < 8:
        raise ValueError("log_mel must have shape [frames, at least 8 mel bins]")
    if n_iter < 1:
        raise ValueError("n_iter must be positive")
    if isinstance(seed, bool) or not isinstance(seed, int):
        raise ValueError("seed must be an integer")
    device = log_mel.device
    n_mels = log_mel.shape[1]
    frequencies = torch.linspace(0, sample_rate / 2, n_fft // 2 + 1, device=device)
    mel_min = 0.0
    mel_max = 2595.0 * math.log10(1.0 + (sample_rate / 2) / 700.0)
    mel_points = torch.linspace(mel_min, mel_max, n_mels + 2, device=device)
    hz_points = 700.0 * (torch.pow(10.0, mel_points / 2595.0) - 1.0)
    filters = []
    for i in range(n_mels):
        left, center, right = hz_points[i:i + 3]
        up = (frequencies - left) / (center - left).clamp_min(1e-6)
        down = (right - frequencies) / (right - center).clamp_min(1e-6)
        filters.append(torch.minimum(up, down).clamp(0, 1))
    bank = torch.stack(filters)
    mel_power = log_mel.float().T.exp()
    linear_power = (torch.linalg.pinv(bank) @ mel_power).clamp_min(1e-8)
    magnitude = linear_power.sqrt()
    generator = torch.Generator(device=device)
    generator.manual_seed(seed)
    phase_angles = 2.0 * math.pi * torch.rand(
        magnitude.shape, device=device, generator=generator,
    )
    phase = torch.polar(torch.ones_like(magnitude), phase_angles)
    spectrum = magnitude.to(torch.complex64) * phase
    window = torch.hann_window(n_fft, device=device)
    length = max(1, (log_mel.shape[0] - 1) * hop_length)
    waveform = torch.zeros(length, device=device)
    for _ in range(n_iter):
        waveform = torch.istft(
            spectrum, n_fft=n_fft, hop_length=hop_length, window=window,
            length=length,
        )
        rebuilt = torch.stft(
            waveform, n_fft=n_fft, hop_length=hop_length, window=window,
            return_complex=True,
        )
        phase = rebuilt / rebuilt.abs().clamp_min(1e-8)
        spectrum = magnitude.to(torch.complex64) * phase
    waveform = torch.istft(
        spectrum, n_fft=n_fft, hop_length=hop_length, window=window,
        length=length,
    )
    return waveform


def decode_audio_codes(model, code_ids: torch.Tensor, sample_rate: int = 16000,
                       griffin_lim_iterations: int = 24) -> torch.Tensor:
    """Decode OneCore audio codes to an approximate mono waveform."""
    with torch.no_grad():
        features = model.decode_audio_codes(code_ids).reshape(
            code_ids.shape[0], -1, model.cfg.audio_bins
        )
        if features.shape[0] != 1:
            raise ValueError("waveform helper currently decodes one sample at a time")
        return log_mel_to_waveform(
            features[0], sample_rate=sample_rate,
            n_iter=griffin_lim_iterations,
        )
