from onecore.curriculum_reference import make_verification, render_answer, solve, verify_record


def test_reference_solvers_cover_math_logic_science_programming_and_translation():
    assert solve("math.integer_arithmetic.v1", {"a": 7, "b": 8, "op": "*"}) == 56
    assert solve("logic.transitive_membership.v1", {
        "premise_a_to_b": True, "premise_b_to_c": True,
    }) == "نعم"
    assert solve("science.fact_lookup.v1", {"fact_id": "water_formula", "language": "ar"}) == "H2O"
    assert solve("programming.output.v1", {"operation": "count_even", "values": [1, 2, 4, 7]}) == "2"
    assert solve("language.translation.v1", {
        "source_language": "ar", "target_language": "en", "word": "ماء",
    }) == "water"


def test_reference_solvers_use_allowlisted_tools_and_bfs():
    result = solve("tool.calculator.v1", {
        "payload": {"name": "calculator", "arguments": {"expression": "(7+5)*3"}},
    })
    assert result["result"]["result"] == 36
    path = solve("algorithms.bfs.v1", {
        "graph": {"A": ["B", "C"], "B": ["A", "D"], "C": ["A", "D"], "D": ["B", "C"]},
        "start": "A", "goal": "D",
    })
    assert len(path) == 3 and path[0] == "A" and path[-1] == "D"


def test_reference_evidence_recomputes_expected_answer_and_text():
    problem = {"a": 7, "b": 8, "op": "*"}
    expected = solve("math.integer_arithmetic.v1", problem)
    answer = render_answer("math.integer_arithmetic.v1", expected)
    record = {
        "task": "text", "problem": problem, "answer": answer,
        "text": "احسب 7 * 8. الإجابة: 56.",
        "verification": make_verification("math.integer_arithmetic.v1", problem, expected),
    }
    assert verify_record(record)
    record["verification"]["expected"] = 55
    assert not verify_record(record)
