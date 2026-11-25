from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import load_config
from .data import read_manifest, validate_manifest
from .inference import load_inference_session
from .model import OneCore
from .train import run_training


def main() -> None:
    parser = argparse.ArgumentParser(prog="onecore")
    sub = parser.add_subparsers(dest="command", required=True)
    inspect = sub.add_parser("inspect", help="print exact parameter and memory report")
    inspect.add_argument("--config", default="configs/phone-research.yaml")
    gate = sub.add_parser("data-gate", help="validate reviewed training metadata and assets")
    gate.add_argument("--root", default=".")
    train = sub.add_parser("train", help="run a bounded CPU training segment")
    train.add_argument("--root", default=".")
    train.add_argument("--config", default="configs/phone-research.yaml")
    train.add_argument("--stage", choices=["smoke", "text", "joint", "multimodal"], required=True)
    train.add_argument("--steps", type=int, default=1)
    train.add_argument("--output-dir", default="run-state")
    train.add_argument("--resume", action="store_true")
    infer = sub.add_parser("infer", help="run verified CPU inference from a OneCore checkpoint")
    infer.add_argument("--root", default=".")
    infer.add_argument("--config", default="configs/phone-research.yaml")
    infer.add_argument("--checkpoint", default="run-state/checkpoint.pt")
    infer.add_argument("--tokenizer", default="run-state/tokenizer.json")
    infer.add_argument("--device", choices=["cpu"], default="cpu")
    infer.add_argument("--prompt", required=True)
    infer.add_argument("--max-new-tokens", type=int, default=128)
    infer.add_argument("--temperature", type=float, default=0.8)
    infer.add_argument("--top-k", type=int, default=40)
    infer.add_argument("--decoding", choices=["causal", "tldm"], default="causal")
    infer.add_argument("--diffusion-steps", type=int, default=8)
    args = parser.parse_args()

    if args.command == "inspect":
        cfg, _, _ = load_config(args.config)
        model = OneCore(cfg)
        print(json.dumps(model.parameter_report(), indent=2))
    elif args.command == "data-gate":
        root = Path(args.root)
        records = read_manifest(root / "data" / "train.jsonl")
        report = validate_manifest(records, root / "data" / "assets")
        print(json.dumps(report, ensure_ascii=False, indent=2))
        if not report["valid"]:
            raise SystemExit(2)
    elif args.command == "train":
        root = Path(args.root)
        report = run_training(
            root, root / args.config, args.stage, args.steps, args.output_dir, args.resume
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
    elif args.command == "infer":
        root = Path(args.root)

        def rooted(path: str) -> Path:
            candidate = Path(path)
            return candidate if candidate.is_absolute() else root / candidate

        session, info = load_inference_session(
            rooted(args.config),
            rooted(args.checkpoint),
            rooted(args.tokenizer),
            device=args.device,
        )
        response = session.chat(
            args.prompt,
            max_new_tokens=args.max_new_tokens,
            temperature=args.temperature,
            top_k=args.top_k,
            decoding=args.decoding,
            diffusion_steps=args.diffusion_steps,
        )
        print(json.dumps({"response": response, **info}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
