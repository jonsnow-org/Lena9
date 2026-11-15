from __future__ import annotations

import hashlib
import json
from collections import deque
from typing import Any

from .tool_runtime import ToolRuntime


SCIENCE_FACTS: dict[str, dict[str, str]] = {
    "water_formula": {
        "question_ar": "ما الصيغة الكيميائية للماء؟",
        "question_en": "What is the chemical formula of water?",
        "answer_ar": "H2O",
        "answer_en": "H2O",
    },
    "earth_orbit": {
        "question_ar": "حول أي جرم تدور الأرض في مدارها السنوي؟",
        "question_en": "Which body does Earth orbit annually?",
        "answer_ar": "الشمس",
        "answer_en": "the Sun",
    },
    "triangle_sides": {
        "question_ar": "كم ضلعًا للمثلث؟",
        "question_en": "How many sides does a triangle have?",
        "answer_ar": "3",
        "answer_en": "three",
    },
    "sound_medium": {
        "question_ar": "ما الذي تحتاج إليه الموجة الصوتية الميكانيكية للانتقال؟",
        "question_en": "What does a mechanical sound wave need to travel?",
        "answer_ar": "وسط مادي",
        "answer_en": "a material medium",
    },
    "photosynthesis": {
        "question_ar": "ما العملية التي تستخدم فيها النباتات الضوء لصنع السكريات؟",
        "question_en": "Which process lets plants use light to make sugars?",
        "answer_ar": "البناء الضوئي",
        "answer_en": "photosynthesis",
    },
    "boiling_water": {
        "question_ar": "ما درجة غليان الماء النقي عند ضغط جوي واحد؟",
        "question_en": "At what temperature does pure water boil at one atmosphere?",
        "answer_ar": "100 درجة مئوية",
        "answer_en": "100 degrees Celsius",
    },
    "light_speed": {
        "question_ar": "ما سرعة الضوء التقريبية في الفراغ؟",
        "question_en": "What is the approximate speed of light in vacuum?",
        "answer_ar": "300000 كيلومتر في الثانية",
        "answer_en": "300000 kilometers per second",
    },
    "human_chromosomes": {
        "question_ar": "كم عدد الكروموسومات في الخلية الجسدية البشرية المعتادة؟",
        "question_en": "How many chromosomes are in a typical human somatic cell?",
        "answer_ar": "46",
        "answer_en": "46",
    },
}

TRANSLATION_PAIRS: dict[str, str] = {
    "water": "ماء", "book": "كتاب", "sun": "شمس", "tree": "شجرة",
    "house": "منزل", "cat": "قط", "light": "ضوء", "road": "طريق",
    "heart": "قلب", "river": "نهر", "bread": "خبز", "key": "مفتاح",
    "door": "باب", "friend": "صديق", "garden": "حديقة",
    "ماء": "water", "كتاب": "book", "شمس": "sun", "شجرة": "tree",
    "منزل": "house", "قط": "cat", "ضوء": "light", "طريق": "road",
    "قلب": "heart", "نهر": "river", "خبز": "bread", "مفتاح": "key",
    "باب": "door", "صديق": "friend", "حديقة": "garden",
}


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def solve(reference: str, problem: dict[str, Any]) -> Any:
    if reference == "math.integer_arithmetic.v1":
        a, b, op = int(problem["a"]), int(problem["b"]), str(problem["op"])
        if op == "+":
            return a + b
        if op == "-":
            return a - b
        if op == "*":
            return a * b
        raise ValueError(f"unsupported arithmetic operator: {op}")

    if reference == "logic.transitive_membership.v1":
        return "نعم" if bool(problem["premise_a_to_b"]) and bool(problem["premise_b_to_c"]) else "لا"

    if reference == "science.fact_lookup.v1":
        fact = SCIENCE_FACTS[str(problem["fact_id"])]
        language = str(problem.get("language", "ar"))
        return fact["answer_ar"] if language == "ar" else fact["answer_en"]

    if reference == "programming.output.v1":
        values = [int(value) for value in problem["values"]]
        operation = str(problem["operation"])
        if operation == "sum":
            return str(sum(values))
        if operation == "max":
            return str(max(values))
        if operation == "reverse":
            return canonical_json(list(reversed(values)))
        if operation == "count_even":
            return str(sum(value % 2 == 0 for value in values))
        raise ValueError(f"unsupported reference programming operation: {operation}")

    if reference == "algorithms.bfs.v1":
        graph = problem["graph"]
        start, goal = str(problem["start"]), str(problem["goal"])
        queue: deque[tuple[str, list[str]]] = deque([(start, [start])])
        visited = {start}
        while queue:
            node, path = queue.popleft()
            if node == goal:
                return path
            for neighbor in sorted(str(value) for value in graph.get(node, [])):
                if neighbor not in visited:
                    visited.add(neighbor)
                    queue.append((neighbor, path + [neighbor]))
        return []

    if reference == "language.translation.v1":
        source, target, word = (
            str(problem["source_language"]),
            str(problem["target_language"]),
            str(problem["word"]),
        )
        if source == "en" and target == "ar":
            return TRANSLATION_PAIRS[word]
        if source == "ar" and target == "en":
            return TRANSLATION_PAIRS[word]
        raise ValueError(f"unsupported translation direction: {source}->{target}")

    if reference == "planning.topological_order.v1":
        tasks = [str(task) for task in problem["tasks"]]
        dependencies = {
            str(task): {str(item) for item in values}
            for task, values in problem["dependencies"].items()
        }
        incoming = {task: set(dependencies.get(task, set())) for task in tasks}
        ready = sorted(task for task in tasks if not incoming[task])
        order: list[str] = []
        while ready:
            task = ready.pop(0)
            order.append(task)
            for candidate in tasks:
                if task in incoming[candidate]:
                    incoming[candidate].remove(task)
                    if not incoming[candidate] and candidate not in order and candidate not in ready:
                        ready.append(candidate)
                        ready.sort()
        if len(order) != len(tasks):
            raise ValueError("planning reference graph contains a cycle")
        return order

    if reference == "spatial.relation.v1":
        positions = problem["positions"]
        left = positions[str(problem["object_a"])]
        right = positions[str(problem["object_b"])]
        relation = str(problem["relation"])
        checks = {
            "left_of": left["x"] < right["x"],
            "right_of": left["x"] > right["x"],
            "above": left["y"] < right["y"],
            "below": left["y"] > right["y"],
        }
        if relation not in checks:
            raise ValueError(f"unsupported spatial relation: {relation}")
        return "نعم" if checks[relation] else "لا"

    if reference in {"tool.calculator.v1", "tool.text_count.v1"}:
        payload = problem["payload"]
        expected_name = "calculator" if reference == "tool.calculator.v1" else "text.count"
        if payload.get("name") != expected_name:
            raise ValueError(f"tool payload name must be {expected_name}")
        return ToolRuntime().dispatch(payload)

    if reference == "media.image_caption.v1":
        return (
            f"خلفية {problem['background']}، {problem['color1']} {problem['shape1']} "
            f"على اليسار و{problem['color2']} {problem['shape2']} على اليمين."
        )

    if reference == "media.audio_transcript.v1":
        if str(problem.get("language", "ar")) == "en":
            return (
                f"Synthetic acoustic cue: a {problem['color1_en']} {problem['shape1_en']} "
                f"moves {problem['direction_en']} on a {problem['background_en']} background."
            )
        return (
            f"إشارة صوتية اصطناعية للمشهد: {problem['color1']} {problem['shape1']} "
            f"يتحرك {problem['direction_ar']} على خلفية {problem['background']}."
        )

    if reference == "media.video_caption.v1":
        return (
            f"فيديو بخلفية {problem['background']}: يتحرك {problem['color1']} {problem['shape1']} "
            f"من {problem['direction_ar']}، بينما يبقى {problem['color2']} {problem['shape2']} ثابتًا."
        )

    raise ValueError(f"unknown deterministic reference solver: {reference}")


def render_answer(reference: str, value: Any) -> str:
    if isinstance(value, bool):
        return "نعم" if value else "لا"
    if isinstance(value, str):
        return value
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else format(value, ".8g")
    if isinstance(value, list):
        if reference in {"algorithms.bfs.v1", "planning.topological_order.v1"}:
            return " → ".join(str(item) for item in value) if value else "لا يوجد مسار"
        return canonical_json(value)
    if isinstance(value, dict):
        return canonical_json(value)
    return str(value)


def make_verification(reference: str, problem: dict[str, Any], expected: Any = None) -> dict[str, Any]:
    value = solve(reference, problem) if expected is None else expected
    digest = hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
    return {
        "method": "deterministic_reference_solver_v1",
        "reference": reference,
        "expected": value,
        "reference_sha256": digest,
    }


def verify_record(record: dict[str, Any]) -> bool:
    verification = record.get("verification")
    if not isinstance(verification, dict) or verification.get("method") != "deterministic_reference_solver_v1":
        return False
    reference = str(verification.get("reference", ""))
    problem = record.get("problem")
    if not reference or not isinstance(problem, dict):
        return False
    expected = verification.get("expected")
    expected_digest = hashlib.sha256(canonical_json(expected).encode("utf-8")).hexdigest()
    if verification.get("reference_sha256") != expected_digest:
        return False
    actual = solve(reference, problem)
    if canonical_json(actual) != canonical_json(expected):
        return False
    answer = render_answer(reference, actual)
    if record.get("answer") != answer:
        return False

    task = str(record.get("task", ""))
    if task == "text":
        return answer in str(record.get("text", ""))
    if task == "tool_use":
        try:
            payload = json.loads(str(record.get("response", "")))
        except json.JSONDecodeError:
            return False
        actual_tool_result = ToolRuntime().dispatch(payload)
        return (
            canonical_json(actual_tool_result) == canonical_json(expected)
            and canonical_json(actual_tool_result) == canonical_json(record.get("expected_tool_result"))
        )
    if task in {"image_caption", "image_reconstruction", "video_caption", "video_reconstruction"}:
        return record.get("caption") == answer
    if task in {"audio_text", "audio_reconstruction"}:
        return record.get("transcript") == answer
    return False
