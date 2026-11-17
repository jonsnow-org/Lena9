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
        "answer_ar": "حوالي 300000 كيلومتر في الثانية",
        "answer_en": "about 300000 kilometers per second",
    },
    "human_chromosomes": {
        "question_ar": "كم عدد الكروموسومات في الخلية الجسدية البشرية المعتادة؟",
        "question_en": "How many chromosomes are in a typical human somatic cell?",
        "answer_ar": "46",
        "answer_en": "46",
    },
    "earth_satellite": {
        "question_ar": "ما القمر الطبيعي للأرض؟",
        "question_en": "What is Earth's natural satellite?",
        "answer_ar": "القمر",
        "answer_en": "the Moon",
    },
    "gravity": {
        "question_ar": "كيف توصف الجاذبية بين الكتل؟",
        "question_en": "How is gravity between masses described?",
        "answer_ar": "قوة تجاذب بين الكتل",
        "answer_en": "an attractive force between masses",
    },
    "oxygen_atomic_number": {
        "question_ar": "ما العدد الذري للأكسجين؟",
        "question_en": "What is the atomic number of oxygen?",
        "answer_ar": "8",
        "answer_en": "8",
    },
    "carbon_atomic_number": {
        "question_ar": "ما العدد الذري للكربون؟",
        "question_en": "What is the atomic number of carbon?",
        "answer_ar": "6",
        "answer_en": "6",
    },
    "earth_rotation": {
        "question_ar": "كم تستغرق دورة الأرض المعتادة حول محورها تقريبًا؟",
        "question_en": "About how long does Earth take to rotate once on its axis?",
        "answer_ar": "حوالي 24 ساعة",
        "answer_en": "about 24 hours",
    },
    "day_night": {
        "question_ar": "ما السبب الأساسي لتعاقب الليل والنهار؟",
        "question_en": "What primarily causes day and night?",
        "answer_ar": "دوران الأرض حول محورها",
        "answer_en": "Earth's rotation on its axis",
    },
    "plant_roots": {
        "question_ar": "ما الذي تمتصه جذور النباتات من التربة؟",
        "question_en": "What do plant roots absorb from soil?",
        "answer_ar": "الماء والأملاح المعدنية",
        "answer_en": "water and mineral salts",
    },
    "cell_unit": {
        "question_ar": "ما الوحدة الأساسية لبنية الكائنات الحية؟",
        "question_en": "What is the basic structural unit of living organisms?",
        "answer_ar": "الخلية",
        "answer_en": "the cell",
    },
    "atom_nucleus": {
        "question_ar": "ما الجسيمات الموجودة في نواة معظم الذرات؟",
        "question_en": "Which particles are in the nuclei of most atoms?",
        "answer_ar": "البروتونات والنيوترونات في معظم الأنوية",
        "answer_en": "protons and neutrons in most nuclei",
    },
    "electron_charge": {
        "question_ar": "ما شحنة الإلكترون؟",
        "question_en": "What is the charge of an electron?",
        "answer_ar": "سالبة",
        "answer_en": "negative",
    },
    "proton_charge": {
        "question_ar": "ما شحنة البروتون؟",
        "question_en": "What is the charge of a proton?",
        "answer_ar": "موجبة",
        "answer_en": "positive",
    },
    "neutron_charge": {
        "question_ar": "ما شحنة النيوترون؟",
        "question_en": "What is the charge of a neutron?",
        "answer_ar": "متعادلة",
        "answer_en": "neutral",
    },
    "water_freezing": {
        "question_ar": "ما درجة تجمد الماء النقي عند ضغط جوي واحد؟",
        "question_en": "At what temperature does pure water freeze at one atmosphere?",
        "answer_ar": "0 درجة مئوية",
        "answer_en": "0 degrees Celsius",
    },
    "meter_centimeter": {
        "question_ar": "كم سنتيمترًا في المتر الواحد؟",
        "question_en": "How many centimeters are in one meter?",
        "answer_ar": "100 سنتيمتر",
        "answer_en": "100 centimeters",
    },
    "kilometer_meter": {
        "question_ar": "كم مترًا في الكيلومتر الواحد؟",
        "question_en": "How many meters are in one kilometer?",
        "answer_ar": "1000 متر",
        "answer_en": "1000 meters",
    },
    "hour_minutes": {
        "question_ar": "كم دقيقة في الساعة الواحدة؟",
        "question_en": "How many minutes are in one hour?",
        "answer_ar": "60 دقيقة",
        "answer_en": "60 minutes",
    },
    "minute_seconds": {
        "question_ar": "كم ثانية في الدقيقة الواحدة؟",
        "question_en": "How many seconds are in one minute?",
        "answer_ar": "60 ثانية",
        "answer_en": "60 seconds",
    },
    "square_sides": {
        "question_ar": "كم ضلعًا متساويًا للمربع؟",
        "question_en": "How many equal sides does a square have?",
        "answer_ar": "4 أضلاع متساوية",
        "answer_en": "four equal sides",
    },
    "rectangle_opposite_sides": {
        "question_ar": "ما العلاقة بين طولي الضلعين المتقابلين في المستطيل؟",
        "question_en": "What is the length relation between opposite sides of a rectangle?",
        "answer_ar": "متساويان في الطول",
        "answer_en": "they are equal in length",
    },
    "circle_edges": {
        "question_ar": "هل للدائرة حواف مستقيمة؟",
        "question_en": "Does a circle have straight edges?",
        "answer_ar": "لا حواف مستقيمة",
        "answer_en": "no straight edges",
    },
    "prime_definition": {
        "question_ar": "ما تعريف العدد الأولي؟",
        "question_en": "What defines a prime number?",
        "answer_ar": "عدد صحيح أكبر من 1 له قاسمان موجبان فقط",
        "answer_en": "an integer greater than 1 with exactly two positive divisors",
    },
    "zero_even": {
        "question_ar": "هل الصفر عدد زوجي؟",
        "question_en": "Is zero an even number?",
        "answer_ar": "نعم",
        "answer_en": "yes",
    },
}

TRANSLATION_PAIRS: dict[str, str] = {
    "water": "ماء",
    "ماء": "water",
    "book": "كتاب",
    "كتاب": "book",
    "sun": "شمس",
    "شمس": "sun",
    "tree": "شجرة",
    "شجرة": "tree",
    "house": "منزل",
    "منزل": "house",
    "cat": "قط",
    "قط": "cat",
    "light": "ضوء",
    "ضوء": "light",
    "road": "طريق",
    "طريق": "road",
    "heart": "قلب",
    "قلب": "heart",
    "river": "نهر",
    "نهر": "river",
    "bread": "خبز",
    "خبز": "bread",
    "key": "مفتاح",
    "مفتاح": "key",
    "door": "باب",
    "باب": "door",
    "friend": "صديق",
    "صديق": "friend",
    "garden": "حديقة",
    "حديقة": "garden",
    "apple": "تفاحة",
    "تفاحة": "apple",
    "milk": "حليب",
    "حليب": "milk",
    "school": "مدرسة",
    "مدرسة": "school",
    "teacher": "معلم",
    "معلم": "teacher",
    "student": "طالب",
    "طالب": "student",
    "window": "نافذة",
    "نافذة": "window",
    "chair": "كرسي",
    "كرسي": "chair",
    "table": "طاولة",
    "طاولة": "table",
    "pencil": "قلم",
    "قلم": "pencil",
    "paper": "ورقة",
    "ورقة": "paper",
    "cloud": "سحابة",
    "سحابة": "cloud",
    "rain": "مطر",
    "مطر": "rain",
    "snow": "ثلج",
    "ثلج": "snow",
    "mountain": "جبل",
    "جبل": "mountain",
    "sea": "بحر",
    "بحر": "sea",
    "fish": "سمكة",
    "سمكة": "fish",
    "bird": "طائر",
    "طائر": "bird",
    "horse": "حصان",
    "حصان": "horse",
    "dog": "كلب",
    "كلب": "dog",
    "flower": "زهرة",
    "زهرة": "flower",
    "seed": "بذرة",
    "بذرة": "seed",
    "fruit": "فاكهة",
    "فاكهة": "fruit",
    "orange": "برتقالة",
    "برتقالة": "orange",
    "lemon": "ليمون",
    "ليمون": "lemon",
    "grape": "عنب",
    "عنب": "grape",
    "clock": "ساعة",
    "ساعة": "clock",
    "time": "وقت",
    "وقت": "time",
    "day": "يوم",
    "يوم": "day",
    "night": "ليل",
    "ليل": "night",
    "morning": "صباح",
    "صباح": "morning",
    "evening": "مساء",
    "مساء": "evening",
    "family": "أسرة",
    "أسرة": "family",
    "mother": "أم",
    "أم": "mother",
    "father": "أب",
    "أب": "father",
    "child": "طفل",
    "طفل": "child",
    "city": "مدينة",
    "مدينة": "city",
    "village": "قرية",
    "قرية": "village",
    "street": "شارع",
    "شارع": "street",
    "market": "سوق",
    "سوق": "market",
    "money": "مال",
    "مال": "money",
    "work": "عمل",
    "عمل": "work",
    "play": "يلعب",
    "يلعب": "play",
    "read": "يقرأ",
    "يقرأ": "read",
    "write": "يكتب",
    "يكتب": "write",
    "eat": "يأكل",
    "يأكل": "eat",
    "drink": "يشرب",
    "يشرب": "drink",
    "sleep": "ينام",
    "ينام": "sleep",
    "walk": "يمشي",
    "يمشي": "walk",
    "run": "يجري",
    "يجري": "run",
    "speak": "يتكلم",
    "يتكلم": "speak",
}
def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def render_tool_history(history: list[dict[str, Any]]) -> str:
    """Render a deterministic, auditable tool trace for the next model decision."""
    if not isinstance(history, list):
        raise TypeError("tool history must be a list")
    lines: list[str] = []
    for index, item in enumerate(history, 1):
        if not isinstance(item, dict) or set(item) != {"payload", "result"}:
            raise ValueError("each tool-history item must contain exactly payload and result")
        lines.append(
            f"الخطوة السابقة {index}: الاستدعاء {canonical_json(item['payload'])}؛ "
            f"النتيجة {canonical_json(item['result'])}"
        )
    return "\n".join(lines)


def solve(reference: str, problem: dict[str, Any]) -> Any:
    if reference == "math.integer_arithmetic.v1":
        a, b, op = int(problem["a"]), int(problem["b"]), str(problem["op"])
        if op == "+":
            return a + b
        if op == "-":
            return a - b
        if op == "*":
            return a * b
        if op == "/":
            if b == 0 or a % b != 0:
                raise ValueError("reference division must be exact and divisor nonzero")
            return a // b
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

    if reference == "tool.discount_workflow_step.v1":
        price = problem.get("price")
        percent = problem.get("discount_percent")
        step = problem.get("step_index")
        if isinstance(price, bool) or not isinstance(price, int) or price <= 0:
            raise ValueError("discount workflow price must be a positive integer")
        if isinstance(percent, bool) or not isinstance(percent, int) or percent not in {5, 10, 12, 15, 20, 25, 30, 40, 50}:
            raise ValueError("discount workflow percent is outside the curriculum range")
        if isinstance(step, bool) or not isinstance(step, int) or step not in {1, 2}:
            raise ValueError("discount workflow step must be 1 or 2")

        runtime = ToolRuntime()
        first_payload = {
            "name": "calculator",
            "arguments": {"expression": f"{price} * {percent} / 100"},
        }
        first_result = runtime.dispatch(first_payload)
        discount = float(first_result["result"]["result"])
        if not discount.is_integer():
            raise ValueError("discount workflow requires an exact whole-number discount")
        second_payload = {
            "name": "calculator",
            "arguments": {"expression": f"{price} - {format(discount, '.10g')}"},
        }
        expected_history = [] if step == 1 else [
            {"payload": first_payload, "result": first_result}
        ]
        if canonical_json(problem.get("history", [])) != canonical_json(expected_history):
            raise ValueError("tool history does not match the replayed previous step")
        expected_payload = first_payload if step == 1 else second_payload
        if canonical_json(problem.get("payload")) != canonical_json(expected_payload):
            raise ValueError("tool payload does not match the expected workflow action")
        return runtime.dispatch(expected_payload)

    if reference == "media.image_caption.v1":
        return (
            f"خلفية {problem['background']}، {problem['color1']} {problem['shape1']} "
            f"على اليسار و{problem['color2']} {problem['shape2']} على اليمين."
        )

    if reference == "media.audio_transcript.v1":
        if str(problem.get("language", "ar")) == "en":
            return (
                f"Synthetic acoustic cue: a {problem['color1_en']} {problem['shape1_en']} "
                f"moves {problem['direction_en']}; a {problem['color2_en']} {problem['shape2_en']} "
                f"remains still on a {problem['background_en']} background."
            )
        return (
            f"إشارة صوتية اصطناعية للمشهد: {problem['color1']} {problem['shape1']} "
            f"يتحرك {problem['direction_ar']}، بينما يبقى {problem['color2']} {problem['shape2']} "
            f"ثابتًا على خلفية {problem['background']}."
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
        text = str(record.get("text", ""))
        if answer not in text:
            return False
        calculator_verification = record.get("calculator_verification")
        if calculator_verification is not None:
            calculator_problem = record.get("calculator_problem")
            if not isinstance(calculator_problem, dict):
                return False
            if calculator_verification.get("method") != "deterministic_reference_solver_v1":
                return False
            if calculator_verification.get("reference") != "math.integer_arithmetic.v1":
                return False
            expected_calculator = calculator_verification.get("expected")
            digest = hashlib.sha256(canonical_json(expected_calculator).encode("utf-8")).hexdigest()
            if calculator_verification.get("reference_sha256") != digest:
                return False
            actual_calculator = solve("math.integer_arithmetic.v1", calculator_problem)
            if canonical_json(actual_calculator) != canonical_json(expected_calculator):
                return False
            expression = (
                f"{calculator_problem['a']} {calculator_problem['op']} "
                f"{calculator_problem['b']} = {render_answer('math.integer_arithmetic.v1', actual_calculator)}"
            )
            if f"الحاسبة: {expression}." not in text:
                return False
        return True
    if task == "tool_use":
        try:
            payload = json.loads(str(record.get("response", "")))
            if canonical_json(payload) != canonical_json(problem.get("payload")):
                return False
            if reference == "tool.discount_workflow_step.v1":
                step = problem.get("step_index")
                prompt = str(record.get("prompt", ""))
                history = problem.get("history", [])
                trace = render_tool_history(history)
                expected_task = (
                    f"احسب السعر النهائي لمنتج سعره {problem['price']} "
                    f"بعد خصم {problem['discount_percent']}%."
                )
                if (
                    record.get("episode_id") != problem.get("episode_id")
                    or record.get("episode_step_index") != step
                    or record.get("episode_step_count") != 2
                    or record.get("episode_task") != expected_task
                    or expected_task not in prompt
                    or record.get("history_trace") != trace
                ):
                    return False
                if trace and trace not in prompt:
                    return False
                if step == 1 and "لا توجد خطوات سابقة" not in prompt:
                    return False
                if step == 2 and not trace:
                    return False
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
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
