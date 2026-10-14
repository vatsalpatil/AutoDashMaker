"""Agent reply parsing across model styles. Run: python tests/test_agent_parse.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_agent_parse_")
os.environ.update(METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads")
from app.services.agent_parse import parse_move  # noqa: E402

m = parse_move('{"thought": "look", "tool": "list_tables", "args": {}}')
assert m["tool"] == "list_tables"
# the reply seen live from openrouter/free
m = parse_move("<|tool_call_start|>[describe_table(table='test.Chocolate_Sales')]<|tool_call_end|>")
assert m == {"tool": "describe_table", "args": {"table": "test.Chocolate_Sales"}, "thought": ""}, m
m = parse_move('[run_sql(sql="SELECT country, SUM(revenue) FROM t GROUP BY 1")]')
assert m["tool"] == "run_sql" and m["args"]["sql"].startswith("SELECT country"), m
m = parse_move('{"name": "sample_rows", "arguments": "{\\"table\\": \\"sales\\", \\"n\\": 3}"}')
assert m["tool"] == "sample_rows" and m["args"] == {"table": "sales", "n": 3}, m
m = parse_move('<tool_call>{"name": "run_sql", "arguments": {"sql": "SELECT 1"}}</tool_call>')
assert m["tool"] == "run_sql" and m["args"]["sql"] == "SELECT 1", m
assert parse_move("Canada leads with $5.1M.")["tool"] == "final"
assert parse_move("<|tool_call_start|>garbled<|tool_call_end|>") is None      # markup without a usable call: ask again
assert parse_move("[describe_table(table=__import__('os'))]") is None     # never executes: literal_eval only
assert parse_move("") is None
print("PASS test_agent_parse")
