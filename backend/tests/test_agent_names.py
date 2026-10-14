"""Agent table names: datasets whose name is not a plain identifier are given to the model by their physical table. Run: python tests/test_agent_names.py"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
TMP = tempfile.mkdtemp(prefix="adm_agent_names_")
os.environ.update(METADATA_DB=f"{TMP}/metadata.duckdb", ANALYTICS_DB=f"{TMP}/analytics.duckdb", UPLOAD_DIR=f"{TMP}/uploads")
from app.services.agent import _label, _shown  # noqa: E402

assert _label({"name": "sales", "physical_name": "ds_sales_1"}) == "sales"
assert _label({"name": "test.Chocolate_Sales", "physical_name": "ds_test_choc_9"}) == "ds_test_choc_9"
assert _label({"name": "my sales", "physical_name": "ds_my_sales"}) == "ds_my_sales"
assert _shown({"name": "test.Chocolate_Sales", "physical_name": "ds_x"}) == 'ds_x (the user calls it "test.Chocolate_Sales")'
assert _shown({"name": "sales", "physical_name": "ds_sales_1"}) == "sales"
print("PASS test_agent_names")
