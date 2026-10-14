"""Agent table names: datasets whose name is not a plain identifier are given to the model by their physical table. Run: python tests/test_agent_names.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_agent_names_")
os.environ.update(METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads")
from app.core.store import store  # noqa: E402
from app.services import names  # noqa: E402
from app.services.agent import _shown  # noqa: E402

store.insert("datasets", {"name": "test.Chocolate_Sales", "physical_name": "ds_test_choc_9"})
store.insert("datasets", {"name": "sales", "physical_name": "ds_sales_1"})
names.invalidate()
# the dotted friendly name resolves in SQL, so prompts can use it as-is
assert "ds_test_choc_9" in names.resolve('SELECT country FROM test.Chocolate_Sales'), names.resolve('SELECT country FROM test.Chocolate_Sales')
assert "ds_sales_1" in names.resolve("SELECT * FROM sales")
assert _shown({"name": "sales", "physical_name": "ds_sales_1"}) == "sales"
assert _shown({"name": "test.Chocolate_Sales", "physical_name": "ds_test_choc_9"}) == "test.Chocolate_Sales"
assert names.resolve("SELECT * FROM other.thing") == "SELECT * FROM other.thing"   # unknown dotted names untouched
print("PASS test_agent_names")
