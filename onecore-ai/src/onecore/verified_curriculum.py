from __future__ import annotations

import hashlib
import json
import math
import random
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageDraw

from .acquire import _append_manifests, _training_manifest_base
from .audio import log_mel_spectrogram
from .curriculum_reference import (
    SCIENCE_FACTS, TRANSLATION_PAIRS, canonical_json, make_verification, render_answer, solve, verify_record,
)
from .data import classify_record_data, read_manifest, validate_manifest, validate_split_disjointness


CURRICULUM_VERSION = "onecore-verified-curriculum-v2"
SEED = 20261115
DOMAINS = (
    "math", "logic", "science", "programming", "algorithms",
    "arabic_language", "english_language", "planning", "spatial",
)
DEFAULT_GROUP_COUNTS = {"train": 1800, "validation": 180, "test": 180}
SPLIT_BASE_IDS = {"train": 0, "validation": 1_000_000, "test": 2_000_000}

SHAPES_AR = ("دائرة", "مربع", "مثلث")
SHAPES_EN = {"دائرة": "circle", "مربع": "square", "مثلث": "triangle"}
SHAPE_KIND = {"دائرة": "circle", "مربع": "square", "مثلث": "triangle"}
COLORS_AR = ("أحمر", "أزرق", "أخضر", "أصفر", "بنفسجي", "برتقالي")
COLORS_EN = {
    "أحمر": "red", "أزرق": "blue", "أخضر": "green",
    "أصفر": "yellow", "بنفسجي": "purple", "برتقالي": "orange",
}
COLOR_RGB = {
    "أحمر": (220, 40, 40), "أزرق": (40, 80, 220), "أخضر": (35, 160, 70),
    "أصفر": (230, 200, 30), "بنفسجي": (145, 60, 180), "برتقالي": (235, 120, 25),
}
BACKGROUNDS_AR = ("أبيض", "رمادي فاتح", "أزرق فاتح", "أسود")
BACKGROUNDS_EN = {
    "أبيض": "white", "رمادي فاتح": "light gray",
    "أزرق فاتح": "light blue", "أسود": "black",
}
BACKGROUND_RGB = {
    "أبيض": (245, 245, 245), "رمادي فاتح": (205, 205, 205),
    "أزرق فاتح": (190, 220, 245), "أسود": (35, 35, 35),
}
F0_BY_COLOR = {"أحمر": 110, "أزرق": 130, "أخضر": 150, "أصفر": 170, "بنفسجي": 190, "برتقالي": 210}
F1_BY_SHAPE = {"دائرة": 480, "مربع": 620, "مثلث": 760}
F2_BY_BACKGROUND = {"أبيض": 1200, "رمادي فاتح": 1450, "أزرق فاتح": 1700, "أسود": 1950}
F3_BY_SHAPE = {"دائرة": 2450, "مربع": 2750, "مثلث": 3050}
F4_BY_COLOR = {"أحمر": 3300, "أزرق": 3500, "أخضر": 3700, "أصفر": 3900, "بنفسجي": 4100, "برتقالي": 4300}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _verified_record(
    split: str, group_id: str, domain: str, suffix: str, task: str,
    reference: str, problem: dict[str, Any], expected: Any, answer: str,
    extra: dict[str, Any] | None = None, asset_sha256: dict[str, str] | None = None,
) -> dict[str, Any]:
    verification = make_verification(reference, problem, expected)
    if asset_sha256:
        verification["asset_sha256"] = asset_sha256
    record: dict[str, Any] = {
        "id": f"{CURRICULUM_VERSION}-{group_id}-{suffix}",
        "task": task,
        "source_url": f"local://onecore-verified-curriculum/{CURRICULUM_VERSION}",
        "split": split,
        "data_class": "synthetic_verified",
        "curriculum_version": CURRICULUM_VERSION,
        "group_id": group_id,
        "domain": domain,
        "difficulty": "basic" if domain in {"math", "arabic_language", "english_language"} else "intermediate",
        "problem": problem,
        "answer": answer,
        "verification": verification,
    }
    if extra:
        record.update(extra)
    return record


def _build_domain_problem(domain: str, rng: random.Random, split: str, domain_index: int) -> tuple[dict[str, Any], str, str]:
    if domain == "math":
        op = rng.choice(("+", "-", "*", "/"))
        if op == "/":
            divisor, quotient = rng.randint(2, 50), rng.randint(2, 50)
            a, b = divisor * quotient, divisor
        else:
            a, b = rng.randint(-999, 999), rng.randint(-999, 999)
        problem = {"a": a, "b": b, "op": op}
        return problem, f"احسب {a} {op} {b}.", "math.integer_arithmetic.v1"

    if domain == "logic":
        categories = (
            "الطيور", "الحيوانات", "الكائنات الحية", "المربعات", "المستطيلات",
            "الأشكال الرباعية", "الأشجار", "النباتات", "الأعداد الزوجية",
            "الأعداد الصحيحة", "الأعداد", "الثدييات", "المواد", "المعادن",
            "المركبات", "العناصر", "الكواكب", "الأجرام السماوية", "النجوم",
            "الطلاب", "الأشخاص", "المواطنون", "السيارات", "وسائل النقل",
            "الأسماك", "الفقاريات", "الحشرات", "الزهور", "الفواكه",
            "الأجهزة", "الأدوات", "المباني", "المدن", "القرى",
        )
        a, b, c = rng.sample(categories, 3)
        premise_a_to_b = rng.choice((True, True, False))
        premise_b_to_c = rng.choice((True, True, False))
        problem = {
            "premise_a_to_b": premise_a_to_b,
            "premise_b_to_c": premise_b_to_c,
            "category_a": a, "category_b": b, "category_c": c,
        }
        first = "صحيحة" if premise_a_to_b else "غير صحيحة"
        second = "صحيحة" if premise_b_to_c else "غير صحيحة"
        question = (
            f"المقدمة الأولى: كل {a} ضمن {b} وهي {first}. "
            f"المقدمة الثانية: كل {b} ضمن {c} وهي {second}. "
            f"هل تثبت المقدمتان أن كل {a} ضمن {c}؟"
        )
        return problem, question, "logic.transitive_membership.v1"

    if domain == "science":
        split_index = {"train": 0, "validation": 1, "test": 2}[split]
        fact_ids = [fact_id for index, fact_id in enumerate(sorted(SCIENCE_FACTS)) if index % 3 == split_index]
        fact_id = fact_ids[domain_index % len(fact_ids)]
        problem = {"fact_id": fact_id, "language": "ar"}
        return problem, SCIENCE_FACTS[fact_id]["question_ar"], "science.fact_lookup.v1"

    if domain == "programming":
        values = [rng.randint(-12, 24) for _ in range(rng.randint(3, 6))]
        operation = rng.choice(("sum", "max", "reverse", "count_even"))
        problem = {"operation": operation, "values": values}
        labels = {"sum": "المجموع", "max": "أكبر قيمة", "reverse": "عكس القائمة", "count_even": "عدد القيم الزوجية"}
        question = f"في Python، نفّذ العملية {labels[operation]} على القائمة {values}. ما الناتج؟"
        return problem, question, "programming.output.v1"

    if domain == "algorithms":
        nodes = list("ABCDEFGH")
        order = rng.sample(nodes, len(nodes))
        edge_set: set[tuple[str, str]] = set()
        for index in range(1, len(order)):
            parent = rng.choice(order[:index])
            edge_set.add(tuple(sorted((parent, order[index]))))
        for index, left in enumerate(nodes):
            for right in nodes[index + 1:]:
                edge = tuple(sorted((left, right)))
                if edge not in edge_set and rng.random() < 0.18:
                    edge_set.add(edge)
        edges = sorted(edge_set)
        graph = {node: [] for node in nodes}
        for left, right in edges:
            graph[left].append(right)
            graph[right].append(left)
        for neighbors in graph.values():
            neighbors.sort()
        start, goal = rng.sample(nodes, 2)
        problem = {"graph": graph, "start": start, "goal": goal}
        edge_text = ", ".join(f"{left}-{right}" for left, right in edges)
        question = f"في رسم بياني غير موجه وغير موزون حوافه {edge_text}، ما أقصر مسار من {start} إلى {goal}؟"
        return problem, question, "algorithms.bfs.v1"

    english_pairs = sorted((word, translation) for word, translation in TRANSLATION_PAIRS.items() if word.isascii())
    split_index = {"train": 0, "validation": 1, "test": 2}[split]
    split_pairs = [pair for index, pair in enumerate(english_pairs) if index % 3 == split_index]
    word_en, word_ar = split_pairs[domain_index % len(split_pairs)]
    if domain == "arabic_language":
        problem = {"source_language": "en", "target_language": "ar", "word": word_en}
        return problem, f"ترجم كلمة {word_en} إلى العربية.", "language.translation.v1"

    if domain == "english_language":
        problem = {"source_language": "ar", "target_language": "en", "word": word_ar}
        return problem, f"Translate the Arabic word '{word_ar}' into English.", "language.translation.v1"

    if domain == "planning":
        task_pool = (
            "تحديد الهدف", "تهيئة البيئة", "جمع البيانات", "تنظيف البيانات", "توحيد البيانات",
            "تحليل المتطلبات", "تصميم الخطة", "تنفيذ التجربة", "تدريب النموذج", "اختبار النتائج",
            "مراجعة الجودة", "حفظ المخرجات", "إعداد التقرير", "نشر النسخة", "مراقبة الأداء",
            "تجهيز المواد", "ترتيب الأدوات", "بدء العمل", "إنهاء المهمة", "مراجعة الخطوات",
            "تحديد الموارد", "توزيع الأدوار", "إعداد الجدول", "التحقق من القيود",
            "بناء النموذج الأولي", "قياس الأداء", "تصحيح الأخطاء", "توثيق القرار",
            "إرسال الملخص", "أرشفة النتائج",
        )
        tasks = rng.sample(task_pool, 6)
        topological_order = rng.sample(tasks, len(tasks))
        dependencies: dict[str, list[str]] = {task: [] for task in tasks}
        for index, task in enumerate(topological_order[1:], 1):
            prerequisites = {rng.choice(topological_order[:index])}
            for candidate in topological_order[:index]:
                if candidate not in prerequisites and rng.random() < 0.25:
                    prerequisites.add(candidate)
            dependencies[task] = sorted(prerequisites)
        problem = {"tasks": tasks, "dependencies": dependencies}
        dependency_text = "؛ ".join(
            f"{task} يعتمد على {', '.join(prerequisites) if prerequisites else 'لا يعتمد على مهام أخرى'}"
            for task, prerequisites in dependencies.items()
        )
        question = "رتب المهام وفق التبعيات التالية: " + dependency_text + "."
        return problem, question, "planning.topological_order.v1"

    if domain == "spatial":
        objects = ["الكرة", "المكعب", "المثلث", "النجمة"]
        coordinates = [(x, y) for x in range(4) for y in range(4)]
        rng.shuffle(coordinates)
        positions = {name: {"x": coordinates[i][0], "y": coordinates[i][1]} for i, name in enumerate(objects)}
        object_a, object_b = rng.sample(objects, 2)
        relation = rng.choice(("left_of", "right_of", "above", "below"))
        relation_ar = {"left_of": "على يسار", "right_of": "على يمين", "above": "فوق", "below": "تحت"}
        problem = {"positions": positions, "object_a": object_a, "object_b": object_b, "relation": relation}
        coordinate_text = "، ".join(
            f"{name}=({point['x']},{point['y']})" for name, point in positions.items()
        )
        question = f"وفق الإحداثيات {coordinate_text}، هل {object_a} {relation_ar[relation]} {object_b}؟"
        return problem, question, "spatial.relation.v1"

    raise ValueError(f"unknown OneCore curriculum domain: {domain}")


def _make_scene(rng: random.Random) -> dict[str, Any]:
    shape1, shape2 = rng.choice(SHAPES_AR), rng.choice(SHAPES_AR)
    color1, color2 = rng.choice(COLORS_AR), rng.choice(COLORS_AR)
    background = rng.choice(BACKGROUNDS_AR)
    direction_ar = rng.choice(("اليسار إلى اليمين", "اليمين إلى اليسار"))
    direction_en = "left to right" if direction_ar == "اليسار إلى اليمين" else "right to left"
    return {
        "shape1": shape1, "shape2": shape2,
        "color1": color1, "color2": color2,
        "background": background,
        "shape1_en": SHAPES_EN[shape1], "shape2_en": SHAPES_EN[shape2],
        "color1_en": COLORS_EN[color1], "color2_en": COLORS_EN[color2],
        "background_en": BACKGROUNDS_EN[background],
        "direction_ar": direction_ar, "direction_en": direction_en,
        "y1": rng.choice((4, 8, 12, 16)),
        "y2": rng.choice((28, 32, 36, 40)),
        "size1": rng.choice((12, 16, 20)),
        "size2": rng.choice((12, 16, 20)),
    }


def _draw_shape(draw: ImageDraw.ImageDraw, shape: str, x: int, y: int, size: int, fill: tuple[int, int, int]) -> None:
    kind = SHAPE_KIND[shape]
    if kind == "circle":
        draw.ellipse((x, y, x + size, y + size), fill=fill)
    elif kind == "square":
        draw.rectangle((x, y, x + size, y + size), fill=fill)
    else:
        draw.polygon(((x + size // 2, y), (x + size, y + size), (x, y + size)), fill=fill)


def _mark_split(image: Image.Image, split: str) -> None:
    marker = ImageDraw.Draw(image)
    marker.rectangle((62, 62, 63, 63), fill=SPLIT_MARKERS[split])


def _write_image_scene(path: Path, scene: dict[str, Any], split: str, rng: random.Random) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (64, 64), BACKGROUND_RGB[scene["background"]])
    draw = ImageDraw.Draw(image)
    _draw_shape(draw, scene["shape1"], 4, scene["y1"], scene["size1"], COLOR_RGB[scene["color1"]])
    _draw_shape(draw, scene["shape2"], 40, scene["y2"], scene["size2"], COLOR_RGB[scene["color2"]])
    image.save(path, format="PNG")


def _write_video_scene(path_list: list[Path], scene: dict[str, Any], split: str) -> None:
    for frame_index, path in enumerate(path_list):
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGB", (64, 64), BACKGROUND_RGB[scene["background"]])
        draw = ImageDraw.Draw(image)
        if scene["direction_ar"] == "اليسار إلى اليمين":
            x = 2 + frame_index * 13
        else:
            x = 41 - frame_index * 13
        _draw_shape(draw, scene["shape1"], x, scene["y1"], scene["size1"], COLOR_RGB[scene["color1"]])
        _draw_shape(draw, scene["shape2"], 40, scene["y2"], scene["size2"], COLOR_RGB[scene["color2"]])
        image.save(path, format="PNG")


def _synthesize_formant_audio(problem: dict[str, Any], split: str, rng: random.Random) -> torch.Tensor:
    sample_rate = 16000
    samples_per_segment = 2400
    f0 = int(problem["f0"])
    f1, f2, f3, f4 = [int(value) for value in problem["formants"]]
    states = [
        [f1, f2, f3, f4],
        [f1 + 80, f2 - 120, f3 + 90, f4 - 60],
        [f1 - 60, f2 + 100, f3 - 80, f4 + 120],
        [f1, f2, f3, f4],
    ]
    if problem["direction_ar"] == "اليمين إلى اليسار":
        states.reverse()
    phase = rng.random() * 2.0 * math.pi
    amplitude = 0.42
    window = torch.hann_window(samples_per_segment, dtype=torch.float32)
    time = torch.arange(samples_per_segment, dtype=torch.float32) / sample_rate
    segments: list[torch.Tensor] = []
    for segment_index, formants in enumerate(states):
        wave = torch.zeros_like(time)
        for harmonic in range(1, 25):
            frequency = f0 * harmonic
            weight = sum(math.exp(-0.5 * ((frequency - center) / 110.0) ** 2) for center in formants)
            wave += (weight / harmonic) * torch.sin(
                2.0 * math.pi * frequency * time + phase + segment_index * 0.13
            )
        peak = wave.abs().max().clamp_min(1e-6)
        segments.append((wave / peak * amplitude) * window)
    return torch.cat(segments).clamp(-0.95, 0.95)


def _audio_problem(scene: dict[str, Any], domain: str) -> dict[str, Any]:
    language = "en" if domain == "english_language" else "ar"
    return scene | {
        "language": language,
        "f0": F0_BY_COLOR[scene["color1"]],
        "formants": [
            F1_BY_SHAPE[scene["shape1"]],
            F2_BY_BACKGROUND[scene["background"]],
            F3_BY_SHAPE[scene["shape2"]],
            F4_BY_COLOR[scene["color2"]],
        ],
        "vowel_pattern": "four_segment_formant_sweep",
        "audio_kind": "synthetic_formant_scene_cue",
    }


def _asset_hashes(paths: list[str], assets_root: Path) -> dict[str, str]:
    return {relative: _sha256(assets_root / relative) for relative in paths}


def _verify_record_assets(record: dict[str, Any], assets_root: Path) -> bool:
    expected = record.get("verification", {}).get("asset_sha256")
    if not isinstance(expected, dict):
        return record.get("task") in {"text", "tool_use"}
    if record.get("task") in {"image_caption", "image_reconstruction"}:
        paths = [record.get("image")]
    elif record.get("task") in {"audio_text", "audio_reconstruction"}:
        paths = [record.get("audio_features")]
    elif record.get("task") in {"video_caption", "video_reconstruction"}:
        paths = record.get("frames")
    else:
        return False
    if not isinstance(paths, list) or any(not isinstance(path, str) or not path.strip() for path in paths):
        return False
    if set(expected) != set(paths):
        return False
    root = assets_root.resolve()
    for relative in paths:
        target = (root / relative).resolve()
        if root not in target.parents or not target.is_file():
            return False
        if expected.get(relative) != _sha256(target):
            return False
    return True


def _filter_heldout_manifests(root: Path) -> dict[str, dict[str, int]]:
    """Preserve the complete held-out manifests for independent evaluation."""
    return {"validation": {}, "test": {}}


def _verify_curriculum_splits(root: Path) -> dict[str, Any]:
    assets_root = root / "data" / "assets"
    records_by_split = {
        split: read_manifest(root / "data" / f"{split}.jsonl")
        for split in ("train", "validation", "test")
    }
    manifest_reports = {
        split: validate_manifest(records_by_split[split], assets_root, expected_split=split)
        for split in ("train", "validation", "test")
    }
    for split, report in manifest_reports.items():
        if not report["valid"]:
            raise ValueError(f"verified curriculum {split} data gate failed: " + "; ".join(report["errors"][:20]))

    generated_by_split: dict[str, list[dict[str, Any]]] = {
        split: [
            record for record in records_by_split[split]
            if record.get("data_class") == "synthetic_verified"
            and record.get("curriculum_version") == CURRICULUM_VERSION
        ]
        for split in ("train", "validation", "test")
    }
    verification_counts: dict[str, int] = {}
    asset_counts: dict[str, int] = {}
    domain_problem_hashes: dict[str, dict[str, set[str]]] = {
        split: {domain: set() for domain in DOMAINS}
        for split in ("train", "validation", "test")
    }
    scene_hashes: dict[str, set[str]] = {split: set() for split in ("train", "validation", "test")}
    scene_by_group: dict[str, dict[str, str]] = {split: {} for split in ("train", "validation", "test")}
    for split, records in generated_by_split.items():
        if not records:
            raise ValueError(f"verified curriculum has no records in {split}")
        checked = 0
        checked_assets = 0
        for record in records:
            if not verify_record(record):
                raise ValueError(f"reference verification failed for generated record {record.get('id')}")
            if not _verify_record_assets(record, assets_root):
                raise ValueError(f"asset hash verification failed for generated record {record.get('id')}")
            checked += 1
            if isinstance(record.get("verification", {}).get("asset_sha256"), dict):
                checked_assets += len(record["verification"]["asset_sha256"])
            if record.get("task") == "text":
                domain = str(record.get("domain", ""))
                if domain not in DOMAINS:
                    raise ValueError(f"unknown verified curriculum domain: {domain}")
                problem_hash = hashlib.sha256(canonical_json(record["problem"]).encode("utf-8")).hexdigest()
                domain_problem_hashes[split][domain].add(problem_hash)
                scene = record.get("scene")
                if not isinstance(scene, dict):
                    raise ValueError(f"verified text record lacks its linked scene: {record.get('id')}")
                scene_hash = hashlib.sha256(canonical_json(scene).encode("utf-8")).hexdigest()
                group_id = str(record.get("group_id", ""))
                prior = scene_by_group[split].get(group_id)
                if prior and prior != scene_hash:
                    raise ValueError(f"scene linkage changed within group {group_id}")
                scene_by_group[split][group_id] = scene_hash
                scene_hashes[split].add(scene_hash)
        verification_counts[split] = checked
        asset_counts[split] = checked_assets

    pair_overlaps: dict[str, dict[str, int]] = {}
    errors: list[str] = []
    for left, right in (("train", "validation"), ("train", "test"), ("validation", "test")):
        problem_overlap = sum(
            len(domain_problem_hashes[left][domain] & domain_problem_hashes[right][domain])
            for domain in DOMAINS
        )
        scene_overlap = len(scene_hashes[left] & scene_hashes[right])
        pair_overlaps[f"{left}__{right}"] = {
            "domain_problem_hashes": problem_overlap,
            "scene_hashes": scene_overlap,
        }
        if problem_overlap:
            errors.append(f"verified problem leakage between {left} and {right}: {problem_overlap} hash(es)")
        if scene_overlap:
            errors.append(f"verified scene leakage between {left} and {right}: {scene_overlap} hash(es)")
    if errors:
        raise ValueError("verified curriculum split gate failed: " + "; ".join(errors))

    heldout_classes = {
        split: sorted({classify_record_data(record) for record in records_by_split[split]})
        for split in ("validation", "test")
    }
    eligible_classes = {"bootstrap", "synthetic", "external", "owner_curated", "other"}
    for split in ("validation", "test"):
        if not heldout_classes[split] or not set(heldout_classes[split]).issubset(eligible_classes):
            raise ValueError(f"{split} held-out set contains an unknown data class")

    split_report = validate_split_disjointness(root)
    return {
        "manifest_reports": manifest_reports,
        "verified_records_checked": verification_counts,
        "verified_assets_sha256_checked": asset_counts,
        "domain_problem_hash_counts": {
            split: {domain: len(values) for domain, values in domain_problem_hashes[split].items()}
            for split in ("train", "validation", "test")
        },
        "scene_hash_counts": {split: len(values) for split, values in scene_hashes.items()},
        "cross_split_overlaps": pair_overlaps,
        "heldout_data_classes": heldout_classes,
        "split_disjointness": split_report,
        "promotion_eligible": False,
    }


def _write_report(
    root: Path, report: dict[str, Any], counts: dict[str, int], added: dict[str, int],
    removed: dict[str, dict[str, int]], validation_report: dict[str, Any],
) -> None:
    report_path = root / "data" / "acquisition-report.json"
    already_generated = isinstance(report.get("verified_curriculum"), dict)
    if not already_generated:
        previous_new = report.get("new_records", {})
        report["new_records"] = {
            split: max(0, int(previous_new.get(split, 0))) + int(added.get(split, 0))
            for split in ("train", "validation", "test")
        }
    report["verified_curriculum"] = {
        "version": CURRICULUM_VERSION,
        "group_counts": counts,
        "record_counts": {split: count * 8 for split, count in counts.items()},
        "validation_report": validation_report,
        "records_added_this_invocation": added,
        "domains": list(DOMAINS),
        "verification_method": "deterministic_reference_solver_v1",
        "asset_integrity": "SHA-256 checked for each generated asset and split-disjointness gated",
        "audio_kind": "synthetic_formant_scene_cue; not natural speech or a trained TTS output",
        "heldout_policy": "validation/test preserve every available data class in independent splits",
        "heldout_removed_by_class": removed,
        "validation": {
            "verified_records_checked": validation_report["verified_records_checked"],
            "verified_assets_sha256_checked": validation_report["verified_assets_sha256_checked"],
            "cross_split_overlaps": validation_report["cross_split_overlaps"],
            "heldout_data_classes": validation_report["heldout_data_classes"],
            "split_disjointness": validation_report["split_disjointness"],
        },
        "promotion_eligible": False,
        "promotion_note": "pilot corpus; quality thresholds and broad natural-speech coverage remain to be calibrated",
    }
    final_fingerprints = _training_manifest_base(root)
    report["extended_train_manifest_sha256"] = final_fingerprints["base_train_manifest_sha256"]
    report["extended_asset_manifest_sha256"] = final_fingerprints["base_asset_manifest_sha256"]
    report["extended_validation_manifest_sha256"] = _sha256(root / "data" / "validation.jsonl")
    report["extended_test_manifest_sha256"] = _sha256(root / "data" / "test.jsonl")
    verified_report_path = root / "data" / "verified-curriculum-report.json"
    verified_report_path.write_text(json.dumps(validation_report | {
        "version": CURRICULUM_VERSION,
        "group_counts": counts,
        "records_added": added,
        "heldout_removed_by_class": removed,
        "extended_train_manifest_sha256": report["extended_train_manifest_sha256"],
        "extended_asset_manifest_sha256": report["extended_asset_manifest_sha256"],
        "extended_validation_manifest_sha256": report["extended_validation_manifest_sha256"],
        "extended_test_manifest_sha256": report["extended_test_manifest_sha256"],
        "promotion_eligible": False,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    report["verified_curriculum_report_sha256"] = _sha256(verified_report_path)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def generate_verified_curriculum(
    project_root: str | Path,
    group_counts: dict[str, int] | None = None,
) -> dict[str, Any]:
    root = Path(project_root).resolve()
    data_root = root / "data"
    assets_root = data_root / "assets"
    counts = dict(DEFAULT_GROUP_COUNTS if group_counts is None else group_counts)
    if set(counts) != {"train", "validation", "test"}:
        raise ValueError("group_counts must specify train, validation and test")
    if any(int(counts[split]) < 1 or int(counts[split]) % len(DOMAINS) for split in counts):
        raise ValueError(f"each split group count must be positive and divisible by {len(DOMAINS)} for balanced domains")
    counts = {split: int(counts[split]) for split in ("train", "validation", "test")}
    for split in counts:
        if not (data_root / f"{split}.jsonl").is_file():
            raise FileNotFoundError(f"bootstrap/acquisition must create data/{split}.jsonl before curriculum generation")

    base_fingerprints = _training_manifest_base(root)
    report_path = data_root / "acquisition-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8")) if report_path.is_file() else {
        "profile": "verified-synthetic-curriculum",
        "source_revisions": {},
        "source_count": 0,
        "sources": [],
        "new_records": {"train": 0, "validation": 0, "test": 0},
        **base_fingerprints,
    }
    parent_metadata: dict[str, Any] = {}
    checkpoint_path = root / "run-state" / "checkpoint.pt"
    if checkpoint_path.is_file():
        payload = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        parent_metadata = payload.get("metadata", {})
        parent_manifest = str(parent_metadata.get("manifest_sha256") or "")
        parent_asset = str(parent_metadata.get("asset_manifest_sha256") or "")
        report_base_manifest = str(report.get("base_train_manifest_sha256") or "")
        report_base_asset = str(report.get("base_asset_manifest_sha256") or "")
        current_base_manifest = str(base_fingerprints.get("base_train_manifest_sha256") or "")
        current_base_asset = str(base_fingerprints.get("base_asset_manifest_sha256") or "")
        prior_extension = parent_metadata.get("data_extension") or {}
        prior_base_manifest = str(prior_extension.get("parent_manifest_sha256") or "")
        prior_base_asset = str(prior_extension.get("parent_asset_manifest_sha256") or "")
        exact_base = current_base_manifest == parent_manifest and current_base_asset == parent_asset
        report_proves_base = report_base_manifest == parent_manifest and report_base_asset == parent_asset
        replay_base = prior_base_manifest == current_base_manifest and prior_base_asset == current_base_asset
        if not parent_manifest or not parent_asset or not (exact_base or report_proves_base or replay_base):
            raise ValueError(
                "verified curriculum lineage guard: current base manifests do not match the parent checkpoint "
                "or its recorded append-only data-extension base; refusing silent data mixing"
            )

    rows_by_split: dict[str, list[dict[str, Any]]] = {split: [] for split in counts}
    domain_group_counts: dict[str, dict[str, int]] = {split: {domain: 0 for domain in DOMAINS} for split in counts}
    seen_domain_problems: dict[str, set[str]] = {domain: set() for domain in DOMAINS}
    seen_scene_hashes: set[str] = set()
    for split in ("train", "validation", "test"):
        split_base = SPLIT_BASE_IDS[split]
        for local_index in range(counts[split]):
            global_index = split_base + local_index
            domain = DOMAINS[local_index % len(DOMAINS)]
            domain_index = local_index // len(DOMAINS)
            domain_group_counts[split][domain] += 1
            rng = random.Random(SEED + global_index)
            group_id = f"onecore-verified-v2-{global_index:07d}"
            split_specific_domain = domain in {"science", "arabic_language", "english_language"}
            for attempt in range(1000):
                domain_problem, question, domain_reference = _build_domain_problem(domain, rng, split, domain_index)
                problem_hash = hashlib.sha256(canonical_json(domain_problem).encode("utf-8")).hexdigest()
                if split_specific_domain or problem_hash not in seen_domain_problems[domain]:
                    seen_domain_problems[domain].add(problem_hash)
                    break
            else:
                raise ValueError(f"could not generate a unique held-out problem for domain {domain}")
            domain_expected = solve(domain_reference, domain_problem)
            domain_answer = render_answer(domain_reference, domain_expected)

            for attempt in range(10000):
                scene = _make_scene(rng)
                scene_hash = hashlib.sha256(canonical_json(scene).encode("utf-8")).hexdigest()
                if scene_hash not in seen_scene_hashes:
                    seen_scene_hashes.add(scene_hash)
                    break
            else:
                raise ValueError("synthetic scene space exhausted; increase scene variation before scaling the corpus")
            image_caption = solve("media.image_caption.v1", scene)
            audio_problem = _audio_problem(scene, domain)
            audio_transcript = solve("media.audio_transcript.v1", audio_problem)
            video_problem = scene | {"motion_frames": 4}
            video_caption = solve("media.video_caption.v1", video_problem)

            calculator_a, calculator_b = rng.randint(2, 30), rng.randint(2, 30)
            calculator_op = rng.choice(("+", "-", "*"))
            calculator_expression = f"{calculator_a} {calculator_op} {calculator_b}"
            tool_text = f"{scene['color1']} {scene['shape1']} {scene['background']}"
            if global_index % 2 == 0:
                tool_payload = {"name": "calculator", "arguments": {"expression": calculator_expression}}
                tool_reference = "tool.calculator.v1"
                tool_problem = {"payload": tool_payload}
                tool_prompt = f"استدعِ calculator لحساب {calculator_expression}."
            else:
                tool_payload = {"name": "text.count", "arguments": {"text": tool_text}}
                tool_reference = "tool.text_count.v1"
                tool_problem = {"payload": tool_payload}
                tool_prompt = f"استدعِ text.count لعدّ الكلمات والأحرف في النص: {tool_text}."
            tool_expected = solve(tool_reference, tool_problem)
            tool_answer = render_answer(tool_reference, tool_expected)
            tool_response = json.dumps(tool_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

            text_label = "Answer" if domain == "english_language" else "الإجابة"
            calculator_value = solve("math.integer_arithmetic.v1", {
                "a": calculator_a, "b": calculator_b, "op": calculator_op,
            })
            calculator_note = f"الحاسبة: {calculator_expression} = {calculator_value}."
            text_body = (
                f"{question}\n{text_label}: {domain_answer}\n"
                f"وصف الصورة المرتبطة: {image_caption}\n"
                f"الوسم الصوتي المرتبط: {audio_transcript}\n"
                f"وصف الحركة المرتبط: {video_caption}\n{calculator_note}"
            )
            rows_by_split[split].append(_verified_record(
                split, group_id, domain, "text", "text",
                domain_reference, domain_problem, domain_expected, domain_answer,
                extra={
                    "text": text_body,
                    "scene": scene,
                    "tool_expression": calculator_expression,
                    "calculator_problem": {"a": calculator_a, "b": calculator_b, "op": calculator_op},
                    "calculator_verification": make_verification(
                        "math.integer_arithmetic.v1",
                        {"a": calculator_a, "b": calculator_b, "op": calculator_op},
                        calculator_value,
                    ),
                },
            ))
            rows_by_split[split].append(_verified_record(
                split, group_id, domain, "tool", "tool_use",
                tool_reference, tool_problem, tool_expected, tool_answer,
                extra={"prompt": tool_prompt, "response": tool_response, "expected_tool_result": tool_expected, "scene": scene},
            ))

            image_relative = f"verified/images/{split}_{global_index:07d}.png"
            image_path = assets_root / image_relative
            _write_image_scene(image_path, scene, split, rng)
            image_hashes = _asset_hashes([image_relative], assets_root)
            for task, suffix in (("image_caption", "image-caption"), ("image_reconstruction", "image-reconstruction")):
                rows_by_split[split].append(_verified_record(
                    split, group_id, domain, suffix, task,
                    "media.image_caption.v1", scene, image_caption, image_caption,
                    extra={"image": image_relative, "caption": image_caption, "scene": scene},
                    asset_sha256=image_hashes,
                ))

            audio_relative = f"verified/audio/{split}_{global_index:07d}.npy"
            audio_path = assets_root / audio_relative
            audio_path.parent.mkdir(parents=True, exist_ok=True)
            wave = _synthesize_formant_audio(audio_problem, split, rng)
            features = log_mel_spectrogram(wave, sample_rate=16000)
            np.save(audio_path, features.numpy().astype("float32"))
            audio_hashes = _asset_hashes([audio_relative], assets_root)
            for task, suffix in (("audio_text", "audio-text"), ("audio_reconstruction", "audio-reconstruction")):
                rows_by_split[split].append(_verified_record(
                    split, group_id, domain, suffix, task,
                    "media.audio_transcript.v1", audio_problem, audio_transcript, audio_transcript,
                    extra={"audio_features": audio_relative, "transcript": audio_transcript, "audio_kind": "synthetic_formant_scene_cue", "scene": scene},
                    asset_sha256=audio_hashes,
                ))

            frame_relatives = [
                f"verified/video/{split}_{global_index:07d}_frame_{frame:02d}.png"
                for frame in range(4)
            ]
            frame_paths = [assets_root / relative for relative in frame_relatives]
            _write_video_scene(frame_paths, scene, split)
            frame_hashes = _asset_hashes(frame_relatives, assets_root)
            for task, suffix in (("video_caption", "video-caption"), ("video_reconstruction", "video-reconstruction")):
                rows_by_split[split].append(_verified_record(
                    split, group_id, domain, suffix, task,
                    "media.video_caption.v1", video_problem, video_caption, video_caption,
                    extra={"frames": frame_relatives, "caption": video_caption, "scene": scene},
                    asset_sha256=frame_hashes,
                ))

    added = _append_manifests(root, rows_by_split)
    removed = _filter_heldout_manifests(root)
    validation_report = _verify_curriculum_splits(root)
    _write_report(root, report, counts, added, removed, validation_report)
    final_fingerprints = _training_manifest_base(root)
    if checkpoint_path.is_file():
        parent_manifest = str(parent_metadata.get("manifest_sha256") or "")
        parent_asset = str(parent_metadata.get("asset_manifest_sha256") or "")
        prior_extension = parent_metadata.get("data_extension") or {}
        replay_base = (
            str(prior_extension.get("parent_manifest_sha256") or "") == str(base_fingerprints.get("base_train_manifest_sha256") or "")
            and str(prior_extension.get("parent_asset_manifest_sha256") or "") == str(base_fingerprints.get("base_asset_manifest_sha256") or "")
        )
        final_matches_parent = (
            str(final_fingerprints.get("base_train_manifest_sha256") or "") == parent_manifest
            and str(final_fingerprints.get("base_asset_manifest_sha256") or "") == parent_asset
        )
        base_matches_parent = (
            str(base_fingerprints.get("base_train_manifest_sha256") or "") == parent_manifest
            and str(base_fingerprints.get("base_asset_manifest_sha256") or "") == parent_asset
        )
        report_base_matches_parent = (
            str(report.get("base_train_manifest_sha256") or "") == parent_manifest
            and str(report.get("base_asset_manifest_sha256") or "") == parent_asset
        )
        if not (base_matches_parent or report_base_matches_parent or (replay_base and final_matches_parent)):
            raise ValueError("verified curriculum final lineage did not match the parent or its recorded extension base")

    return {
        "status": "generated" if any(added.values()) else "already-present",
        "version": CURRICULUM_VERSION,
        "group_counts": counts,
        "record_counts": {split: count * 8 for split, count in counts.items()},
        "records_added": added,
        "domain_group_counts": domain_group_counts,
        "task_counts_per_split": {split: {task: counts[split] for task in (
            "text", "tool_use", "image_caption", "image_reconstruction",
            "audio_text", "audio_reconstruction", "video_caption", "video_reconstruction",
        )} for split in counts},
        "validation_report": validation_report,
        "verification_method": "deterministic_reference_solver_v1",
        "promotion_eligible": False,
    }

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Generate and verify OneCore deterministic synthetic curriculum")
    parser.add_argument("--root", default="onecore-ai")
    parser.add_argument("--train-groups", type=int, default=DEFAULT_GROUP_COUNTS["train"])
    parser.add_argument("--validation-groups", type=int, default=DEFAULT_GROUP_COUNTS["validation"])
    parser.add_argument("--test-groups", type=int, default=DEFAULT_GROUP_COUNTS["test"])
    args = parser.parse_args()
    report = generate_verified_curriculum(args.root, {
        "train": args.train_groups,
        "validation": args.validation_groups,
        "test": args.test_groups,
    })
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
