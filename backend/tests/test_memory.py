"""AI memory (Markdown files): CRUD, safety, remember command, prompt injection, per-workspace isolation.
Run: backend/.venv/Scripts/python.exe tests/test_memory.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
tmp = tempfile.mkdtemp()
os.environ.update(METADATA_DB=tmp + "/m.duckdb", ANALYTICS_DB=tmp + "/a.duckdb", DUCKDB_TEMP_DIR=tmp + "/s", UPLOAD_DIR=tmp + "/up")

from app.core import tenant
from app.services import ai, memory as m

# ---- starter file exists, untouched starter adds nothing to prompts ----
files = m.list_files()
assert files[0]["name"] == "MEMORY.md" and files[0]["main"], files
assert m.prompt_text() == "", repr(m.prompt_text())

# ---- write / read / rename / delete; bad names refused ----
m.write("business-terms.md", "# Terms\n- revenue = net of refunds\n")
assert "net of refunds" in m.read("business-terms")
for bad in ["../x.md", "a/b.md", ".hidden.md", "x.txt/..", ""]:
    try:
        m.write(bad, "x"); raise SystemExit(f"accepted bad name {bad!r}")
    except m.MemoryError:
        pass
m.rename("business-terms.md", "terms.md")
assert [f["name"] for f in m.list_files()] == ["MEMORY.md", "terms.md"]
try:
    m.rename("MEMORY.md", "other.md"); raise SystemExit("renamed main")
except m.MemoryError:
    pass

# ---- remember command + bullets + duplicates ----
assert m.remember_command("remember that fiscal year starts in April") == "fiscal year starts in April"
assert m.remember_command("Please remember: use INR for money") == "use INR for money"
assert m.remember_command("what is revenue by region?") is None
assert not m.remember("fiscal year starts in April")["duplicate"]
assert m.remember("Fiscal year starts in April")["duplicate"]
assert "- fiscal year starts in April" in m.read("MEMORY.md")

# ---- injected into every model call (system prompt), MEMORY.md first; off switch works ----
seen = []
ai._call = lambda cfg, msgs, *a, **k: (seen.append(msgs), "ok")[1]
ai.resolve_provider = lambda pid=None: {"provider": "groq", "model": "x", "api_key": "k"}
ai.chat([{"role": "system", "content": "SYS"}, {"role": "user", "content": "hi"}])
sys_msg = seen[-1][0]["content"]
assert sys_msg.startswith("SYS") and "fiscal year starts in April" in sys_msg and "net of refunds" in sys_msg, sys_msg
assert sys_msg.index("MEMORY.md") < sys_msg.index("terms.md")
ai.chat([{"role": "user", "content": "hi"}])
assert seen[-1][0]["role"] == "system" and "fiscal" in seen[-1][0]["content"]
m.set_enabled(False)
ai.chat([{"role": "user", "content": "hi"}])
assert seen[-1] == [{"role": "user", "content": "hi"}]
m.set_enabled(True)

# ---- Ask: "remember …" never calls the model ----
from app.services import analyst
n = len(seen)
out = analyst.answer("remember that sales means units sold", [], None, None)
assert out["status"] == "not_a_query" and "Saved to your AI memory" in out["detail"] and len(seen) == n, out
assert "sales means units sold" in m.read("MEMORY.md")

# ---- each workspace has its own memory ----
with tenant.use("ws_other"):
    assert "fiscal" not in m.read("MEMORY.md") if (m.folder() / "MEMORY.md").exists() else True
    m.list_files()
    assert "fiscal" not in m.read("MEMORY.md") and m.prompt_text() == ""

# ---- delete: topic file removed, main file reset ----
m.delete("terms.md"); m.delete("MEMORY.md")
assert [f["name"] for f in m.list_files()] == ["MEMORY.md"] and "fiscal" not in m.read("MEMORY.md")
print("test_memory OK")
