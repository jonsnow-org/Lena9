# OneCore low-bit research roadmap

The single OneCore model currently uses full-precision parameters. Low-bit storage and quantization-aware training remain future experiments; no quantized checkpoint or alternate runtime is currently part of the model.

Before quantization work:

1. Complete a reproducible full-precision CPU/resource baseline for the current model configuration.
2. Train and independently evaluate one real-data checkpoint across text, tool, image, audio and video.
3. Establish per-family quality and latency baselines.
4. Compare ternary/1.58-bit quantization-aware training and per-layer/per-channel calibration using approved training activations.
5. Pack ternary symbols with a documented binary format and round-trip tests.
6. Measure actual target-device CPU latency, peak memory and output quality.

Use `onecore.v3.report.build_report()` for the canonical parameter and storage report. Storage estimates are theoretical, not proof of a quantized runtime, measured RAM or quality improvement. No quality gate may be inferred from training loss alone.
