"""Blueprints the AI dashboard generator follows: what pages to build, what each widget is for, naming, SQL rules, formulas.

The model only fills these blueprints with queries; page structure, widget roles and the rule sheet are fixed here so
two generations over the same data have the same shape.
"""
from __future__ import annotations

TEMPLATES: dict[str, dict] = {
    "auto": {
        "name": "Best fit (AI decides)",
        "description": "Overview, Breakdown and Details pages, with the widgets the AI judges best for this data.",
        "pages": [("overview", "Overview"), ("breakdown", "Breakdown"), ("details", "Details")],
        "blueprint": (
            "overview: 3-4 KPIs that matter most for THIS data (totals, an average or rate, a record count, and a growth % of the latest complete "
            "period vs the one before when a date exists), a trend over time when a date exists, and the single most important ranking.\n"
            "breakdown: 3-4 charts splitting the main measure by the most useful dimensions (bar, pie of at most 8 slices, composed or treemap), "
            "and one dimension-by-time chart when a date exists. Choose the dimensions and chart types that fit the data.\n"
            "details: one table of the most informative rows (named columns only, at most 50) and, when it suits the data, one pivot-style table."),
    },
    "executive": {
        "name": "Executive overview",
        "description": "Headline KPIs, trend and rankings on page one; breakdowns and a detail table behind it.",
        "pages": [("overview", "Overview"), ("breakdown", "Breakdown"), ("details", "Details")],
        "blueprint": (
            "overview: 4 KPIs (total of the main measure, average per record or per entity, record count, and a growth % "
            "of the latest period vs the one before when a date exists), a trend line/area over time, a top-10 bar of the "
            "best dimension, a pie/donut share of a second dimension (max 8 slices).\n"
            "breakdown: 3-4 charts splitting the main measure by other dimensions (bar, composed, treemap); one "
            "dimension-by-time chart if a date exists.\n"
            "details: one table of the top 50 rows by the main measure (named columns only) and one pivot-style table "
            "(dimension by dimension, or dimension by month)."),
    },
    "performance": {
        "name": "Performance & growth",
        "description": "Growth rates, period comparison, rankings, share and concentration.",
        "pages": [("performance", "Performance"), ("rankings", "Rankings"), ("concentration", "Concentration")],
        "blueprint": (
            "performance: KPIs for total, latest period, previous period and change % (window LAG); a trend of the measure "
            "with its period-over-period growth %; a running total.\n"
            "rankings: top 10 and bottom 10 of the best dimension (two bars), best and worst period.\n"
            "concentration: share of total per dimension value, how much the top 10 values contribute (one KPI %), "
            "cumulative share (Pareto) as a composed chart."),
    },
    "sales_compare": {
        "name": "Daily sales comparison",
        "description": "Latest day vs the day before: KPIs with previous values, top items with growth, what drove the change, groups to push or fix.",
        "pages": [("today", "Latest Day"), ("trend", "Trend"), ("details", "Details")],
        "blueprint": (
            "Use the LATEST date in the data as 'current' and the date before it as 'previous' (MAX(date) and MAX(date) - INTERVAL 1 DAY); "
            "never today's clock date.\n"
            "today: KPIs total sales and total units of the latest day, average selling price (sales / units), and the year-to-date total; "
            "a ranked widget of the main dimension (category, current-day value, previous-day value, LIMIT 10); a waterfall of the change per "
            "dimension value (top 6 changes + 'Others'); a pie share of the latest day by that dimension (max 7 slices); a quadrant widget "
            "(same three columns as the ranked one).\n"
            "trend: a composed chart of daily sales and units over the last 30 days; a bar of the main dimension over the month.\n"
            "details: a growth table (dimension, current, previous, change, growth %) and a pivot of dimension by a second dimension."),
    },
    "report_center": {
        "name": "Report center",
        "description": "One page per key dimension with the same KPI strip, time breakdown, top 10, rate and detail table.",
        "pages": [("overview", "Overview"), ("dim1", "Breakdown 1"), ("dim2", "Breakdown 2"), ("details", "Details")],
        "blueprint": (
            "Pick the 2 most useful dimensions; name pages dim1 and dim2 after them (e.g. Portal, Category).\n"
            "overview: KPIs for gross total, units, average selling price (total / units), a rate (e.g. returns / sold when such columns "
            "exist, else share of the top item) and a ratio KPI; a monthly trend of the main measure; a pie share of the first dimension.\n"
            "each breakdown page: KPIs (active count of that dimension, top item by value, units, average value per unit); a pivot of the "
            "dimension by YEAR (row field, year as column field, main measure); a top-10 bar of the dimension; a bar of a rate or average per "
            "dimension value; a detail table per dimension value with every useful total.\n"
            "details: the 50 most informative rows."),
    },
    "operations": {
        "name": "Operations & data checks",
        "description": "Pareto items, restock candidates, slow movers, duplicate / suspicious records and geography.",
        "pages": [("executive", "Executive"), ("operations", "Operations"), ("checks", "Data Checks"), ("geography", "Geography")],
        "blueprint": (
            "executive: KPIs for gross total, net total (after returns/refunds when such columns exist), refund or return rate, the number of "
            "Pareto items (items making 80% of the total), and text KPIs for the top item and the top region/channel (one row, one text column).\n"
            "operations: a table of restock candidates (high units over the last 30 days of the data, low return rate, LIMIT 20); a table of slow "
            "movers / stockout signals (items with 1-2 units in the last 30 days); a ranked widget of items this month vs last month.\n"
            "checks: tables of possible data problems found by rules: duplicate ids/invoice numbers (COUNT > 1), entities with several refunds, "
            "same-day refunds, NULL or empty key fields; a KPI per check with its count.\n"
            "geography (only when a place column exists): top 10 places by value (bar), a sankey of from -> to routes when both exist, and a "
            "table per place with value, count and rate."),
    },
    "explorer": {
        "name": "Data explorer",
        "description": "Distributions, relationships, outliers and category mixes for getting to know a dataset.",
        "pages": [("distribution", "Distributions"), ("relationships", "Relationships"), ("outliers", "Outliers")],
        "blueprint": (
            "distribution: for the 2 main measures a histogram-style bar (FLOOR(x / step) buckets) plus median, mean and p90 "
            "KPIs; top values of the main categorical columns.\n"
            "relationships: a scatter of the two most related measures (at most 2000 rows, USING SAMPLE), average of a "
            "measure per category, category-by-category counts.\n"
            "outliers: count and share of rows beyond 3 standard deviations on the main measure (KPIs), the 20 most extreme "
            "rows (table)."),
    },
    "quality": {
        "name": "Data health",
        "description": "Completeness, duplicates, freshness and the shape of the data.",
        "pages": [("health", "Health"), ("columns", "Columns")],
        "blueprint": (
            "health: KPIs for record count, duplicate-key share (when an id column exists), newest and oldest date, share of "
            "rows with any NULL in the main columns; rows per period as a trend.\n"
            "columns: a bar of NULL % per column (one UNION ALL query, top 15), a bar of distinct count per column, "
            "a table of the dimension values with the fewest rows."),
    },
}

DATA_BASICS = """Data basics to reason with:
- One row = one event/entity (an order, a visit, a customer). Decide what a row is first; COUNT(*) then means "how many of those".
- Measure = a number you add up or average (revenue, quantity, cost). Dimension = a label you split by (region, product, status). Time = a date used for trends. ID = identifies rows: count it, never sum it.
- Grain = the level of detail of a row; never sum a value that repeats at a finer grain. Totals and averages answer "how much", rankings "which", trends "when", shares "how it splits", distributions "how spread out".
- A good KPI is one number with a clear meaning (total, average per unit, rate, growth). A good dashboard moves from headline numbers, to trend, to breakdowns, to detail rows.
- Be wary of columns with many empty values, a single distinct value, or very high cardinality (poor to group by)."""

NAMING_RULES = """Naming rules (every title is shown to business users):
- Titles are short business phrases in Title Case, 2-6 words, that say WHAT is measured and HOW it is cut. Never a column name, alias or snake_case.
- KPI: the measure and aggregation, e.g. "Total Revenue", "Average Order Value", "Orders This Month", "Revenue Growth vs Last Month".
- Trend: "<Measure> by <Grain>", e.g. "Monthly Revenue Trend". Ranking: "Top 10 <Dimension> by <Measure>". Share: "<Measure> Share by <Dimension>". Table: "<What> Detail".
- Every title is unique in the dashboard. Page names are 1-2 words (Overview, Regions, Products, Details).
- Output column aliases are readable snake_case of the same idea (total_revenue, order_month)."""

FORMULAS = """Formulas you may use (DuckDB):
- share of total: ROUND(100.0 * SUM(m) / NULLIF(SUM(SUM(m)) OVER (), 0), 1)
- growth % vs previous period: ROUND(100.0 * (cur - prev) / NULLIF(prev, 0), 1) with prev = LAG(cur) OVER (ORDER BY period)
- running total: SUM(SUM(m)) OVER (ORDER BY period)
- average per entity: SUM(m) / NULLIF(COUNT(DISTINCT entity), 0); margin %: 100.0 * SUM(profit) / NULLIF(SUM(revenue), 0)
- median and percentiles: QUANTILE_CONT(m, 0.5), QUANTILE_CONT(m, 0.9); spread: STDDEV_SAMP(m)
- outliers: m > AVG(m) OVER () + 3 * STDDEV_SAMP(m) OVER ()
- conditional totals: SUM(m) FILTER (WHERE cond); time buckets: DATE_TRUNC('month', d)
- Pareto count (items making 80% of the total): WITH t AS (SELECT item, SUM(m) v FROM x GROUP BY 1), c AS (SELECT v, SUM(v) OVER (ORDER BY v DESC) / SUM(v) OVER () cum FROM t) SELECT COUNT(*) FILTER (WHERE cum - v / (SELECT SUM(v) FROM t) < 0.8) FROM c
- ratio KPI (e.g. sold per returned): ROUND(SUM(a) / NULLIF(SUM(b), 0), 1) with the chart option numberFormat 'ratio' (shows 3.2 : 1)
- current vs previous per item: SUM(m) FILTER (WHERE d = (SELECT MAX(d) FROM x)) AS cur, SUM(m) FILTER (WHERE d = (SELECT MAX(d) FROM x) - INTERVAL 1 DAY) AS prev"""

SQL_RULES = """Query rules (queries are checked and run; slow or invalid ones are dropped):
- Aggregate inside SQL and return few rows: KPI = exactly 1 row; trend <= 400 rows; rankings LIMIT 10-15; tables LIMIT 50.
- Select only the columns the widget needs. Never SELECT * except inside a CTE that is then aggregated. Never DISTINCT *.
- One pass over the table per widget: use one CTE or conditional aggregation (FILTER) instead of several subqueries or self-joins. No correlated subqueries, no cross joins.
- Use the exact table name given. Quote odd column names with double quotes. Give EVERY output column a short snake_case alias.
- Divide only with NULLIF(denominator, 0); ROUND money and percentages to 1-2 decimals. Exclude NULL dimension values with WHERE col IS NOT NULL when ranking.
- Time series: DATE_TRUNC at the suggested grain, first column = the period, ORDER BY the period.
- Growth / period-over-period KPIs: compare the last two COMPLETE periods; if the data ends part-way through a period (see the time range), leave that period out. ROUND every KPI and money value to at most 2 decimals.
- Chart fit: kpi = one numeric value; line/area = period first then measures; bar/pie/funnel/treemap = category first then ONE measure, ORDER BY measure DESC; scatter = two numeric columns; table/pivot = readable named columns.
- Big tables: prefer APPROX_COUNT_DISTINCT over COUNT(DISTINCT) beyond ~1M rows, and sample scatter data with USING SAMPLE 2000 ROWS."""


def template_list() -> list[dict]:
    return [{"id": k, "name": v["name"], "description": v["description"], "pages": [n for _, n in v["pages"]]} for k, v in TEMPLATES.items()]
