from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageDraw

from .audio import log_mel_spectrogram


LICENSE = "local-owner-synthetic"
SOURCE = "local://onecore-bootstrap"
ATTRIBUTION = "Generated deterministically by the OneCore project bootstrap curriculum; no third-party data."
PALETTE = {
    "red": (220, 52, 63),
    "blue": (45, 104, 205),
    "green": (42, 160, 100),
    "yellow": (242, 190, 48),
    "purple": (137, 82, 181),
    "orange": (237, 132, 48),
}
BACKGROUNDS = {
    "white": (245, 245, 242),
    "black": (28, 31, 38),
    "light blue": (177, 213, 235),
    "light gray": (205, 208, 214),
}
SHAPES = ("circle", "square", "triangle")


def _record(record_id: str, task: str, split: str, **fields: Any) -> dict[str, Any]:
    return {
        "id": record_id, "task": task, "license": LICENSE,
        "source_url": SOURCE, "attribution": ATTRIBUTION, "split": split,
        "review_status": "generated",
        **fields,
    }


def _text_records(split: str, count: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    records = []
    facts_ar = [
        "المثلث شكل هندسي له ثلاثة أضلاع وثلاث زوايا.",
        "تدور الأرض حول الشمس، وتدور حول محورها أيضاً.",
        "يتكون جزيء الماء من ذرتي هيدروجين وذرة أكسجين.",
        "تستخدم النباتات ضوء الشمس والماء وثاني أكسيد الكربون في عملية البناء الضوئي.",
        "تنتقل الحرارة من الجسم الأعلى حرارة إلى الجسم الأقل حرارة عند التلامس.",
        "الصوت موجة ميكانيكية تحتاج إلى وسط مادي كي تنتقل.",
        "تتكون الكسرية من بسط ومقام، ولا يجوز أن يكون المقام صفراً.",
        "تتغير حالة المادة عند اكتساب الطاقة الحرارية أو فقدانها.",
        "تساعد علامات الترقيم على توضيح بنية الجملة ومعناها.",
        "تُقاس المسافة بوحدات مثل المتر والكيلومتر.",
    ]
    facts_en = [
        "A triangle has three sides and three interior angles.",
        "Earth orbits the Sun and also rotates around its axis.",
        "A water molecule contains two hydrogen atoms and one oxygen atom.",
        "Plants use sunlight, water, and carbon dioxide during photosynthesis.",
        "Heat flows from a warmer object to a cooler object in direct contact.",
        "Sound is a mechanical wave and needs a medium to travel.",
        "A fraction has a numerator and a denominator; the denominator cannot be zero.",
        "Matter can change state when thermal energy is added or removed.",
        "Punctuation helps readers understand sentence structure and meaning.",
        "Distance can be measured in units such as metres and kilometres.",
    ]
    templates_ar = [
        "إذا كان لدينا {a} صندوقاً وفي كل صندوق {b} كتب، فإن العدد الكلي للكتب هو {product}.",
        "عند توزيع {total} قطعة بالتساوي على {groups} مجموعات، تحصل كل مجموعة على {share} قطعة.",
        "العدد {a} أكبر من العدد {b} بمقدار {difference}. ويمكن التحقق من ذلك بالطرح.",
        "بدأت رحلة في الساعة {start} واستغرقت {duration} ساعات، لذلك انتهت في الساعة {end}.",
        "للتأكد من صحة الحل، نعوّض الناتج في العملية الأصلية ونقارن الطرفين.",
        "السؤال الجيد يحدد المطلوب والمعطيات والقيود قبل اختيار طريقة الحل.",
        "يمكن تمثيل الفكرة نفسها بكلمات أو جدول أو رسم أو معادلة.",
        "عندما تتعارض النتيجة مع المعطيات، يجب مراجعة الافتراضات والحسابات.",
    ]
    templates_en = [
        "There are {a} boxes with {b} books in each box, so the total is {product} books.",
        "When {total} objects are divided equally into {groups} groups, each group receives {share}.",
        "The number {a} is greater than {b} by {difference}; subtraction verifies the claim.",
        "A journey starts at hour {start} and lasts {duration} hours, so it ends at hour {end}.",
        "To verify a solution, substitute the result into the original operation and compare both sides.",
        "A clear problem statement identifies the goal, known facts, and constraints before choosing a method.",
        "The same idea can be represented with words, a table, a diagram, or an equation.",
        "When a result conflicts with the given facts, check assumptions and calculations.",
    ]
    for i in range(count):
        a = rng.randint(2, 19)
        b = rng.randint(2, 12)
        groups = rng.randint(2, 9)
        total = groups * rng.randint(2, 20)
        duration = rng.randint(1, 7)
        start = rng.randint(1, 17)
        values = {
            "a": a, "b": b, "product": a * b, "groups": groups,
            "total": total, "share": total // groups,
            "difference": a - b, "duration": duration,
            "start": start, "end": start + duration,
        }
        if i % 3 == 0:
            text = facts_ar[i % len(facts_ar)] + " " + rng.choice(templates_ar).format(**values)
        elif i % 3 == 1:
            text = facts_en[i % len(facts_en)] + " " + rng.choice(templates_en).format(**values)
        else:
            text = (
                "المعرفة العلمية تعتمد على الملاحظة والقياس وإمكانية التحقق. "
                + facts_ar[i % len(facts_ar)] + " "
                + rng.choice(templates_ar).format(**values)
            )
        records.append(_record(f"{split}-text-{i:04d}", "text", split, text=text))
    return records


def _tool_records(split: str, count: int, seed: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    records = []
    for i in range(count):
        a = rng.randint(1, 200)
        b = rng.randint(1, 100)
        op = rng.choice(["+", "-", "*"])
        result = {"+": a + b, "-": a - b, "*": a * b}[op]
        expression = f"{a}{op}{b}"
        prompt = f"استخدم أداة calculator لحساب {a} {op} {b} وأعد استدعاء الأداة بصيغة JSON فقط."
        response = json.dumps({
            "name": "calculator",
            "arguments": {"expression": expression},
        }, ensure_ascii=False, separators=(",", ":"))
        records.append(_record(
            f"{split}-tool-{i:04d}", "tool_use", split,
            prompt=prompt, response=response,
        ))
    return records


def _draw_image(path: Path, shape: str, color_name: str, background_name: str,
                x: int, y: int, size: int = 20) -> None:
    image = Image.new("RGB", (64, 64), BACKGROUNDS[background_name])
    draw = ImageDraw.Draw(image)
    fill = PALETTE[color_name]
    left, top = x, y
    right, bottom = min(63, x + size), min(63, y + size)
    if shape == "circle":
        draw.ellipse((left, top, right, bottom), fill=fill)
    elif shape == "square":
        draw.rectangle((left, top, right, bottom), fill=fill)
    else:
        draw.polygon([(x + size // 2, y), (x, y + size), (x + size, y + size)], fill=fill)
    image.save(path, format="PNG", optimize=True)


def _image_records(split: str, count: int, seed: int, assets: Path) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    records = []
    for i in range(count):
        shape = SHAPES[i % len(SHAPES)]
        color = list(PALETTE)[(i // len(SHAPES)) % len(PALETTE)]
        background = list(BACKGROUNDS)[(i // 2) % len(BACKGROUNDS)]
        x = rng.randint(3, 36)
        y = rng.randint(3, 36)
        relative = f"images/{split}_{i:04d}.png"
        path = assets / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        _draw_image(path, shape, color, background, x, y, size=rng.randint(16, 25))
        caption = f"A {color} {shape} on a {background} background."
        records.append(_record(
            f"{split}-image-{i:04d}", "image_caption", split,
            image=relative, caption=caption,
        ))
    return records


def _audio_records(split: str, count: int, seed: int, assets: Path) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    records = []
    sample_rate = 16000
    duration = 0.55
    time = torch.arange(int(sample_rate * duration), dtype=torch.float32) / sample_rate
    for i in range(count):
        base = rng.choice([110, 165, 220, 330, 440, 550, 660])
        second = rng.choice([0, 55, 110, 165])
        phase = rng.random() * math.pi
        wave = 0.45 * torch.sin(2 * math.pi * base * time + phase)
        if second:
            wave = wave + 0.2 * torch.sin(2 * math.pi * (base + second) * time)
        wave = wave.clamp(-0.95, 0.95)
        features = log_mel_spectrogram(wave, sample_rate=sample_rate)
        relative = f"audio/{split}_{i:04d}.npy"
        path = assets / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        np.save(path, features.numpy().astype("float32"))
        transcript = (
            f"A steady synthetic tone near {base} hertz"
            + (f" with a second tone near {base + second} hertz." if second else ".")
        )
        records.append(_record(
            f"{split}-audio-{i:04d}", "audio_text", split,
            audio_features=relative, transcript=transcript,
        ))
    return records


def _video_records(split: str, count: int, seed: int, assets: Path) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    records = []
    for i in range(count):
        shape = "square" if i % 2 == 0 else "circle"
        color = list(PALETTE)[i % len(PALETTE)]
        background = list(BACKGROUNDS)[(i // 2) % len(BACKGROUNDS)]
        start = rng.randint(2, 12)
        direction = 1 if i % 2 == 0 else -1
        frames = []
        positions = []
        for frame in range(4):
            x = start + direction * frame * 9
            y = 18 + (frame * 3 if i % 3 == 0 else 0)
            x = max(1, min(38, x))
            y = max(1, min(38, y))
            positions.append((x, y))
            relative = f"video/{split}_{i:04d}_frame_{frame:02d}.png"
            path = assets / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            _draw_image(path, shape, color, background, x, y, size=18)
            frames.append(relative)
        movement = "left to right" if direction > 0 else "right to left"
        caption = f"A {color} {shape} moves {movement} across a {background} background."
        records.append(_record(
            f"{split}-video-{i:04d}", "video_caption", split,
            frames=frames, caption=caption,
        ))
    return records


def generate_bootstrap(project_root: str | Path, force: bool = False) -> dict[str, Any]:
    root = Path(project_root).resolve()
    data_root = root / "data"
    assets = data_root / "assets"
    train_manifest = data_root / "train.jsonl"
    validation_manifest = data_root / "validation.jsonl"
    test_manifest = data_root / "test.jsonl"
    if train_manifest.exists() or validation_manifest.exists() or test_manifest.exists():
        if not (train_manifest.exists() and validation_manifest.exists()):
            raise FileExistsError("train.jsonl and validation.jsonl must both exist before adding a test split; refusing to mix or overwrite data")
        if force:
            train_manifest.unlink(missing_ok=True)
            validation_manifest.unlink(missing_ok=True)
            test_manifest.unlink(missing_ok=True)
        elif not test_manifest.exists():
            # Add a new independent held-out test split without rewriting the
            # existing train/validation manifests or changing their lineage.
            assets.mkdir(parents=True, exist_ok=True)
            test_records = (
                _text_records("test", 40, 301)
                + _tool_records("test", 15, 302)
                + _image_records("test", 12, 303, assets)
                + _audio_records("test", 12, 304, assets)
                + _video_records("test", 8, 305, assets)
            )
            rng = random.Random(314160)
            rng.shuffle(test_records)
            test_manifest.write_text(
                "\n".join(json.dumps(item, ensure_ascii=False) for item in test_records) + "\n",
                encoding="utf-8",
            )
            return {
                "status": "added-independent-test-split",
                "train_manifest_preserved": True,
                "validation_manifest_preserved": True,
                "test_records": len(test_records),
                "assets": sum(1 for p in assets.rglob("*") if p.is_file()),
                "promotion_eligible": False,
            }
        else:
            return {"status": "skipped-existing-data", "train_manifest": str(train_manifest),
                    "validation_manifest": str(validation_manifest), "test_manifest": str(test_manifest)}

    assets.mkdir(parents=True, exist_ok=True)
    train_records = (
        _text_records("train", 180, 101)
        + _tool_records("train", 60, 102)
        + _image_records("train", 48, 103, assets)
        + _audio_records("train", 48, 104, assets)
        + _video_records("train", 24, 105, assets)
    )
    validation_records = (
        _text_records("validation", 40, 201)
        + _tool_records("validation", 15, 202)
        + _image_records("validation", 12, 203, assets)
        + _audio_records("validation", 12, 204, assets)
        + _video_records("validation", 8, 205, assets)
    )
    rng = random.Random(314159)
    rng.shuffle(train_records)
    rng.shuffle(validation_records)
    data_root.mkdir(parents=True, exist_ok=True)
    train_manifest.write_text(
        "\n".join(json.dumps(item, ensure_ascii=False) for item in train_records) + "\n",
        encoding="utf-8",
    )
    validation_manifest.write_text(
        "\n".join(json.dumps(item, ensure_ascii=False) for item in validation_records) + "\n",
        encoding="utf-8",
    )
    test_records = (
        _text_records("test", 40, 301)
        + _tool_records("test", 15, 302)
        + _image_records("test", 12, 303, assets)
        + _audio_records("test", 12, 304, assets)
        + _video_records("test", 8, 305, assets)
    )
    test_rng = random.Random(314160)
    test_rng.shuffle(test_records)
    test_manifest.write_text(
        "\n".join(json.dumps(item, ensure_ascii=False) for item in test_records) + "\n",
        encoding="utf-8",
    )
    return {
        "status": "generated-synthetic-bootstrap",
        "train_records": len(train_records),
        "validation_records": len(validation_records),
        "test_records": len(test_records),
        "assets": sum(1 for p in assets.rglob("*") if p.is_file()),
        "training_data_kind": "synthetic_bootstrap",
        "promotion_eligible": False,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate deterministic synthetic OneCore bootstrap data")
    parser.add_argument("--root", default=".")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    print(json.dumps(generate_bootstrap(args.root, force=args.force), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
