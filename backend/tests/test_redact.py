"""Connector errors must never show passwords. Run: backend/.venv/Scripts/python.exe tests/test_redact.py"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.connectors.base import ConnectorError, redact  # noqa: E402

# the exact shape TiDB / the MySQL driver produced (password in plain text inside the message)
raw = ('IO Error: Failed to connect to MySQL database with parameters "host=gw.tidbcloud.com port=4000 database=sys '
       'user=abc password=Sup3rSecret! ssl_ca=/app/certs/x.pem": Missing user name prefix.')
out = str(ConnectorError(raw))
assert "Sup3rSecret" not in out and "password=***" in out, out
assert "host=gw.tidbcloud.com" in out and "Missing user name prefix" in out, "the useful part of the error must stay"
assert "hunter2" not in redact("postgresql://bob:hunter2@db.example.com:5432/x") and "bob" in redact("postgresql://bob:hunter2@db.example.com:5432/x")
assert "abc123" not in redact("api_key: abc123 failed")
assert "my pass" not in redact("pwd='my pass' x")
assert redact("nothing secret here") == "nothing secret here"
print("redact tests OK")
