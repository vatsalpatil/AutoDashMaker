"""Option tables of the visual query builder: join types, aggregates, buckets, window functions, filter operators."""
JOINS = {"left": "LEFT JOIN", "inner": "INNER JOIN", "right": "RIGHT JOIN", "full": "FULL OUTER JOIN", "cross": "CROSS JOIN"}
AGGS = {  # fn -> template with {c} = the column expression
    "count": "COUNT(*)", "count_col": "COUNT({c})", "count_distinct": "COUNT(DISTINCT {c})", "sum": "SUM({c})", "avg": "AVG({c})",
    "min": "MIN({c})", "max": "MAX({c})", "median": "MEDIAN({c})", "stddev": "STDDEV_SAMP({c})", "variance": "VAR_SAMP({c})",
    "mode": "MODE({c})", "first": "FIRST({c})", "last": "LAST({c})", "list": "STRING_AGG(CAST({c} AS VARCHAR), ', ')",
    "p25": "QUANTILE_CONT({c}, 0.25)", "p75": "QUANTILE_CONT({c}, 0.75)", "p90": "QUANTILE_CONT({c}, 0.9)",
    "p95": "QUANTILE_CONT({c}, 0.95)", "p99": "QUANTILE_CONT({c}, 0.99)", "null_count": "COUNT(*) - COUNT({c})",
    "null_pct": "ROUND(100.0 * (COUNT(*) - COUNT({c})) / NULLIF(COUNT(*), 0), 2)", "range": "MAX({c}) - MIN({c})",
}
BUCKETS = {
    "year": "DATE_TRUNC('year', {c})", "quarter": "DATE_TRUNC('quarter', {c})", "month": "DATE_TRUNC('month', {c})",
    "week": "DATE_TRUNC('week', {c})", "day": "DATE_TRUNC('day', {c})", "hour": "DATE_TRUNC('hour', {c})",
    "minute": "DATE_TRUNC('minute', {c})", "day_of_week": "DAYNAME({c})", "month_of_year": "MONTHNAME({c})",
    "hour_of_day": "EXTRACT(hour FROM {c})", "year_month": "STRFTIME({c}, '%Y-%m')", "text_length": "LENGTH({c})",
}
WINDOWS = {  # fn -> (template, needs column)
    "running_sum": ("SUM({c}) OVER ({p}{o} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)", True),
    "running_avg": ("AVG({c}) OVER ({p}{o} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)", True),
    "running_count": ("COUNT(*) OVER ({p}{o} ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)", False),
    "moving_avg": ("AVG({c}) OVER ({p}{o} ROWS BETWEEN {n} PRECEDING AND CURRENT ROW)", True),
    "moving_sum": ("SUM({c}) OVER ({p}{o} ROWS BETWEEN {n} PRECEDING AND CURRENT ROW)", True),
    "rank": ("RANK() OVER ({p}{o})", False), "dense_rank": ("DENSE_RANK() OVER ({p}{o})", False),
    "row_number": ("ROW_NUMBER() OVER ({p}{o})", False), "ntile": ("NTILE({n}) OVER ({p}{o})", False),
    "lag": ("LAG({c}, {n}) OVER ({p}{o})", True), "lead": ("LEAD({c}, {n}) OVER ({p}{o})", True),
    "diff_prev": ("{c} - LAG({c}, {n}) OVER ({p}{o})", True),
    "pct_change": ("100.0 * ({c} - LAG({c}, {n}) OVER ({p}{o})) / NULLIF(LAG({c}, {n}) OVER ({p}{o}), 0)", True),
    "pct_of_total": ("100.0 * {c} / NULLIF(SUM({c}) OVER ({p}), 0)", True),
    "pct_rank": ("PERCENT_RANK() OVER ({p}{o})", False),
    "first_value": ("FIRST_VALUE({c}) OVER ({p}{o})", True), "last_value": ("LAST_VALUE({c}) OVER ({p}{o} ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)", True),
    "z_score": ("({c} - AVG({c}) OVER ({p})) / NULLIF(STDDEV_SAMP({c}) OVER ({p}), 0)", True),
}
UNARY = {"is_null": "{c} IS NULL", "not_null": "{c} IS NOT NULL", "is_empty": "({c} IS NULL OR CAST({c} AS VARCHAR) = '')",
         "not_empty": "({c} IS NOT NULL AND CAST({c} AS VARCHAR) <> '')", "is_true": "{c} IS TRUE", "is_false": "{c} IS FALSE",
         "today": "CAST({c} AS DATE) = CURRENT_DATE", "this_week": "DATE_TRUNC('week', {c}) = DATE_TRUNC('week', CURRENT_DATE)",
         "this_month": "DATE_TRUNC('month', {c}) = DATE_TRUNC('month', CURRENT_DATE)",
         "this_quarter": "DATE_TRUNC('quarter', {c}) = DATE_TRUNC('quarter', CURRENT_DATE)",
         "this_year": "DATE_TRUNC('year', {c}) = DATE_TRUNC('year', CURRENT_DATE)"}
CMP = {"=": "=", "!=": "<>", ">": ">", ">=": ">=", "<": "<", "<=": "<="}
