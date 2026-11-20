from __future__ import annotations

import ast
import json
import math
import operator
from typing import Any, Callable


class ToolCallError(ValueError):
    pass


class SafeCalculator(ast.NodeVisitor):
    """Small arithmetic evaluator. Never uses eval/exec and never imports code."""
    OPS = {
        ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod, ast.Pow: operator.pow,
    }
    UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}

    def visit_Expression(self, node: ast.Expression) -> float:
        return self.visit(node.body)

    def visit_Constant(self, node: ast.Constant) -> float:
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise ToolCallError("only numeric constants are accepted")
        return float(node.value)

    def visit_UnaryOp(self, node: ast.UnaryOp) -> float:
        op = self.UNARY.get(type(node.op))
        if op is None:
            raise ToolCallError("unsupported unary operation")
        return op(self.visit(node.operand))

    def visit_BinOp(self, node: ast.BinOp) -> float:
        op = self.OPS.get(type(node.op))
        if op is None:
            raise ToolCallError("unsupported arithmetic operation")
        left, right = self.visit(node.left), self.visit(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 8:
            raise ToolCallError("exponent is outside the safe bound")
        result = op(left, right)
        if not math.isfinite(result) or abs(result) > 1e100:
            raise ToolCallError("result is outside the safe numeric range")
        return float(result)

    def generic_visit(self, node: ast.AST) -> float:
        raise ToolCallError(f"unsupported expression element: {type(node).__name__}")


def calculate(expression: str) -> float:
    if not isinstance(expression, str) or len(expression) > 256:
        raise ToolCallError("expression must be a string of at most 256 characters")
    try:
        tree = ast.parse(expression, mode="eval")
        return SafeCalculator().visit(tree)
    except (SyntaxError, ZeroDivisionError, OverflowError) as exc:
        raise ToolCallError(str(exc)) from exc


class ToolRuntime:
    """Allowlisted tool dispatcher; model output is data, never executable code."""
    def __init__(self) -> None:
        self._handlers: dict[str, Callable[[dict[str, Any]], Any]] = {
            "calculator": self._calculator,
            "text.count": self._text_count,
        }

    @staticmethod
    def _calculator(arguments: dict[str, Any]) -> dict[str, float]:
        if set(arguments) != {"expression"}:
            raise ToolCallError("calculator accepts exactly the expression field")
        return {"result": calculate(arguments["expression"])}

    @staticmethod
    def _text_count(arguments: dict[str, Any]) -> dict[str, int]:
        if set(arguments) != {"text"} or not isinstance(arguments["text"], str):
            raise ToolCallError("text.count accepts exactly one text string")
        text = arguments["text"]
        return {"characters": len(text), "words": len(text.split())}

    def dispatch(self, payload: str | dict[str, Any]) -> dict[str, Any]:
        if isinstance(payload, str):
            if len(payload.encode("utf-8")) > 8192:
                raise ToolCallError("tool payload exceeds 8 KiB")
            try:
                call = json.loads(payload)
            except json.JSONDecodeError as exc:
                raise ToolCallError("tool payload must be valid JSON") from exc
        else:
            call = payload
        if not isinstance(call, dict) or set(call) != {"name", "arguments"}:
            raise ToolCallError("tool call must contain exactly name and arguments")
        name, arguments = call["name"], call["arguments"]
        if not isinstance(name, str) or not isinstance(arguments, dict):
            raise ToolCallError("invalid tool call shape")
        handler = self._handlers.get(name)
        if handler is None:
            raise ToolCallError(f"tool is not allowlisted: {name}")
        return {"name": name, "ok": True, "result": handler(arguments)}
