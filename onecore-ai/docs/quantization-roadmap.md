# Low-bit research roadmap

The current baseline deliberately trains and stores full-precision weights. Parameter-count reduction and low-bit storage must be measured rather than assumed.

Planned experiments after a reproducible baseline exists:

1. Ternary/1.58-bit quantization-aware training from random initialization, using a straight-through estimator.
2. Compare per-layer and per-channel scale calibration using only OneCore training activations.
3. Report validation loss and every modality metric before/after quantization.
4. Pack ternary symbols into a compact binary representation with a versioned format and round-trip tests.
5. Benchmark actual Android CPU latency and memory, not just theoretical bits-per-weight.

No quantized checkpoint is considered valid until unpacking, deterministic inference, and all quality gates pass. Theoretical storage estimates in `model.parameter_report()` are estimates only; they are not evidence that a quantized runtime exists.
