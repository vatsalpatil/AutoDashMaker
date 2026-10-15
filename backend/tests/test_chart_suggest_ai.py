"""Plain-assert tests: backend/.venv/Scripts/python.exe tests/test_chart_suggest_ai.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.services import chart_suggest_ai as m

reply = '{"suggestions": [{"type": "BAR", "title": "Top cities", "reason": "rank"}, {"type": "hologram"}, {"type": "bar"}, {"type": "pie", "title": "Share"}]}'
m.ai_svc.chat = lambda *a, **k: reply
assert [s["type"] for s in m.suggest(["city", "revenue"], [{"city": "A", "revenue": 1}], "share")] == ["bar", "pie"]
m.ai_svc.chat = lambda *a, **k: "sorry, no idea"
assert m.suggest(["a"], []) == []
print("ok")
