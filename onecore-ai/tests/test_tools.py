import pytest

from onecore.tool_runtime import ToolCallError, ToolRuntime, calculate


def test_safe_calculator_and_registered_tool():
    assert calculate("(12 + 8) * 3") == 60
    result = ToolRuntime().dispatch({"name": "calculator", "arguments": {"expression": "7**2"}})
    assert result["result"]["result"] == 49


def test_tool_runtime_rejects_code_and_unknown_tools():
    runtime = ToolRuntime()
    with pytest.raises(ToolCallError):
        calculate("__import__('os').system('id')")
    with pytest.raises(ToolCallError):
        runtime.dispatch({"name": "shell.exec", "arguments": {"command": "rm -rf /"}})
    with pytest.raises(ToolCallError):
        runtime.dispatch({"name": "calculator", "arguments": {"expression": "1+1", "extra": 3}})
