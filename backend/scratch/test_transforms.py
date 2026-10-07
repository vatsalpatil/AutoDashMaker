import sys
sys.path.insert(0, ".")
import polars as pl
from app.services.transforms import run_python

df = pl.DataFrame({"a": [1, 2, 3]})
code = """
x = len(df)
result = df.with_columns(pl.lit(x).alias("count"))
"""
try:
    res = run_python(code, df)
    print("Success")
except Exception as e:
    print("Error:", e)
