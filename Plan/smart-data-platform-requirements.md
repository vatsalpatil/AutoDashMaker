# Smart Data Platform — Product Requirements & Technical Design
## Research-backed blueprint for an AI-native, industry-focused data platform

**Document status:** Product + architecture blueprint  
**Research date:** 25 September 2026  
**Target deployment:** Single 4 vCPU / 20 GB RAM / 200 GB disk server managed with Dokploy  
**Primary stack:** FastAPI + Python, DuckDB, Polars, Vite + TypeScript, shadcn/ui, self-hosted Supabase/PostgreSQL  
**Working product category:** AI-native BI / GenBI / data analyst platform

---

# 1. Executive Summary

The product should not be positioned as another "chat with your database" demo.

The goal is a **smart, simple, trustworthy operational data platform**:

> **Connect your business data → understand what it means → ask a business question → get a verified answer → see why the answer is correct → turn it into a dashboard/alert/workflow → act on it.**

The strongest common pattern across current AI-data products is:

1. connect a database/data source;
2. discover schema;
3. give an AI agent business/schema context;
4. translate natural language into a query;
5. execute it;
6. visualize the result;
7. let the user refine the question;
8. save the result to a dashboard;
9. share/embed/refresh it.

Chat2DB emphasizes AI SQL generation, visualization, dashboards, real-time updates, Excel analysis, and broad database support. AskYourDatabase combines conversational SQL, visualizations, dashboards, schema/business context, training examples, access control and embedding. Draxlr emphasizes schema-aware read-only AI SQL, visible SQL, dashboards, embedding and row-level security. DataReporter emphasizes open-source/self-hosted AI BI, 40+ connectors and cloud/local models. Metabase adds an AI agent, semantic context, MCP, summaries, semantic search and agent-driven dashboard creation. Holistics takes a more governed route: natural language is translated into its own analytical language and then deterministically compiled to SQL using governed metrics rather than directly generating SQL. Hex extends the concept into code-capable data apps and AI-assisted SQL/Python/chart workflows. Seek AI separates dialogue, semantic parsing and result explanation into agentic stages. Wren AI focuses on an open-source semantic/context layer and governed text-to-SQL.

The product opportunity is therefore **not merely "better text-to-SQL."**

The differentiation should be:

### "Business-aware answers that are verifiable and operational."

The platform should tell a user:

- **What happened**
- **How much**
- **Compared with what**
- **Why it happened**
- **What data was used**
- **What assumptions were made**
- **How confident the system is**
- **What action should be considered**
- **Whether the issue needs attention now**

The final product should feel closer to a **digital data analyst + lightweight BI + data-quality monitor + operational alerting layer** than a SQL chatbot.

---

# 2. Research Scope

The competitive research focused on products and architectures in the AI-native analytics / BI / GenBI category:

- Chat2DB
- AskYourDatabase
- AskYourDB
- ByeSQL
- DataReporter
- Draxlr
- Metabase
- Holistics
- Hex
- Seek AI
- Wren AI
- Apache Superset

The exact capabilities and commercial offerings of these products change quickly. This document uses official product/documentation sources where available and treats vendor claims as descriptions of their products, not independent performance benchmarks.

---

# 3. Competitive Feature Map

| Capability | Chat2DB | AskYourDatabase | Draxlr | DataReporter | Metabase | Holistics | Hex | Seek AI | Wren AI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Natural-language data chat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Text-to-SQL | ✓ | ✓ | ✓ | ✓ | ✓ | indirect/AQL | ✓ | ✓ | ✓ |
| Generated charts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AI dashboard creation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Follow-up questions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| SQL visibility/editing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Business/semantic context | partial | ✓ | schema-focused | ✓ | ✓ | **strong** | ✓ | ✓ | **strong** |
| Semantic metrics layer | limited | context | limited | context | models | **core** | workspace | semantic parsing | **core** |
| Dashboard sharing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Embedding | varies | ✓ | **✓** | varies | ✓ | ✓ | ✓ | ✓ | ✓ |
| Row-level security | varies | ✓ | **✓** | varies | ✓ | ✓ | ✓ | ✓ | depends on deployment |
| Local/self-hosted | ✓/varies | enterprise option | varies | **✓** | **✓** | varies | no traditional self-host focus | enterprise | **✓** |
| Local model support | varies | varies | varies | **Ollama** | BYO/provider | provider-dependent | provider-dependent | enterprise | open-source ecosystem |
| MCP | emerging | varies | **✓** | varies | **✓** | emerging | emerging | agentic | agentic |
| AI summaries | ✓ | ✓ | ✓ | ✓ | **✓** | **✓** | ✓ | **✓** | ✓ |
| Alerts/monitoring | varies | varies | ✓ | varies | ✓ | ✓ | ✓ | enterprise | buildable |
| Code/Python environment | limited | no | no | limited | limited | development | **strong** | no-code focus | engine focus |

### Core observation

Almost every product converges on:

**Question → Query → Result → Visualization → Dashboard**

The product should extend this to:

**Question → Context → Plan → Query → Validate → Result → Explanation → Action → Monitor**

That extra validation/action/monitoring loop is the main product opportunity.

---

# 4. What the Competitors Actually Do

## 4.1 Chat2DB

### Strengths

Chat2DB is positioned as a broad AI database client rather than only a dashboard product.

Its documented capabilities include:

- AI SQL generation
- AI SQL editor
- AI dashboards
- automatic visualization
- dashboard customization
- real-time dashboard updates
- Excel analysis
- support for many SQL and NoSQL databases
- database management features

Official documentation says it supports 24+ databases, including PostgreSQL, MySQL, ClickHouse, MongoDB, Snowflake, Oracle and others.

### Working model

Typical flow:

```text
User question
      ↓
Schema/database context
      ↓
LLM generates SQL
      ↓
SQL execution
      ↓
Table/result
      ↓
AI visualization
      ↓
Dashboard
```

### Key lesson

Broad connector support is attractive, but broad database management can make the product feel like a developer tool rather than a business decision system.

### Weakness / opportunity

A new product should not try to beat Chat2DB by supporting every database on day one.

Instead:

- support PostgreSQL first;
- CSV/Excel first-class;
- Parquet;
- REST/API sources;
- add connectors based on actual customer demand.

**Source:** Chat2DB AI Dashboard documentation.

---

## 4.2 AskYourDatabase

AskYourDatabase is one of the closest competitors to the intended product.

### Strengths

Its current product describes:

- natural-language database questions;
- generated SQL;
- inspectable SQL;
- charts generated through conversation;
- dashboards generated using natural language;
- schema explanations;
- business context;
- training examples;
- fine-grained access control;
- embeddable chatbot;
- multiple database connectors;
- live dashboards.

### Important architectural lesson

The product does not only provide an LLM answer. It creates a loop:

```text
Question
  ↓
Interpretation
  ↓
SQL
  ↓
Execution
  ↓
Result
  ↓
Visualization
  ↓
Follow-up
  ↓
Dashboard
```

This conversational continuity is important.

### Weakness / opportunity

A generic database chatbot still leaves the user responsible for:

- deciding what KPI matters;
- checking whether the query is statistically meaningful;
- understanding anomalies;
- identifying data-quality problems;
- deciding what action follows.

Your product should take responsibility for more of this analytical workflow while keeping humans in control.

---

## 4.3 AskYourDB

AskYourDB focuses on:

- natural-language questions;
- automatic SQL generation;
- dashboards;
- charts;
- database connections;
- sharing.

Its simplicity is useful as a product lesson.

### Lesson

The interface should not look like a traditional BI administration console on first launch.

The primary interaction should be:

> **"What do you want to know?"**

Traditional BI functionality can remain one click away.

---

## 4.4 ByeSQL

ByeSQL follows the "ChatGPT for your database" model:

- connect database;
- ask natural-language questions;
- generate SQL;
- visualize answers;
- create reusable dashboards.

### Lesson

A chat interface is an excellent entry point, but chat alone is not a complete product.

The chat should be an **analysis command center**, not the entire application.

---

# 5. DataReporter

DataReporter is particularly relevant because it is open-source/self-hosted oriented.

It describes:

- AI connected to databases;
- natural-language questions;
- charts and tables;
- dashboard construction;
- 40+ connectors;
- cloud AI models;
- local models such as Ollama;
- visual exploration;
- self-hosting.

### Strength

This is close to the infrastructure philosophy of the proposed project.

### Weakness / opportunity

Connector breadth can become a maintenance burden.

Instead, build a strong abstraction:

```text
Data Source
    ↓
Connector
    ↓
Canonical Dataset
    ↓
Schema + Metadata
    ↓
Semantic Model
    ↓
Query Engine
    ↓
Analytics
```

This lets the UI and AI operate against a stable internal model rather than every connector being special-cased.

---

# 6. Draxlr

Draxlr has especially useful AI design patterns.

Its documentation describes:

- natural-language SQL;
- schema-aware generation;
- read-only AI queries;
- optional automatic execution;
- visible generated SQL;
- tables/charts;
- follow-up questions;
- dashboard-ready results.

Its product also emphasizes:

- embedded analytics;
- customer-specific data scoping;
- signed filters;
- white labeling;
- row-level security;
- MCP.

### Important lesson: transparency

Do not hide the SQL/query plan.

Show:

```text
Question
↓
Interpretation
↓
Data sources
↓
Generated query
↓
Validation
↓
Result
```

Users should be able to inspect every important step.

### Important security principle

AI-generated queries should default to **read-only**.

Never let a natural-language analytics agent freely execute:

```sql
DROP
DELETE
UPDATE
INSERT
ALTER
TRUNCATE
```

The analytics agent should have a dedicated read-only database role.

---

# 7. Metabase

Metabase is important because it demonstrates what happens when traditional BI is combined with AI.

Its current AI capabilities include:

- Metabot;
- natural-language data questions;
- query generation;
- chart explanations;
- document creation;
- AI summaries;
- semantic search;
- MCP;
- AI usage analytics;
- permission controls;
- agent-driven dashboard/content creation.

Metabase also documents an agent workflow where an agent can create questions and dashboards in a development environment and promote changes through a controlled workflow.

### Major lesson

AI should not be a separate chatbot bolted onto the BI system.

AI should be able to operate the platform itself:

```text
Create dataset
Create query
Create chart
Create dashboard
Explain chart
Search dashboard
Modify dashboard
```

But production changes should have approval/versioning.

---

# 8. Holistics

Holistics contains one of the most important architectural ideas for your project.

Instead of:

```text
Natural language → SQL
```

Holistics describes:

```text
Natural language
      ↓
AQL / analytical representation
      ↓
Governed metric definitions
      ↓
Deterministic SQL compilation
      ↓
Database
```

This is substantially safer than asking an LLM to directly invent SQL every time.

### Why this matters

Suppose a company defines:

```text
Revenue = SUM(successful_payment.amount)
```

and asks:

> "What was revenue last month?"

A generic LLM might choose the wrong table or status.

A semantic layer says:

```text
Revenue
  = metric.revenue

Orders
  = metric.orders

Active Customer
  = customer with ≥ 1 successful order in period
```

The AI works with these definitions.

### This should become a core feature of your platform.

---

# 9. Hex

Hex demonstrates a different direction.

It combines:

- SQL;
- Python;
- charts;
- markdown;
- AI assistance;
- interactive data apps;
- generative apps.

### Lesson

There are users who eventually need to escape the no-code abstraction.

Therefore the platform should have:

### Simple mode

```text
Ask → Analyze → Dashboard
```

and:

### Advanced mode

```text
SQL
Python/Polars
DuckDB
Custom transformations
```

Do not force advanced users into a no-code UI.

---

# 10. Seek AI

Seek AI separates the problem into multiple conceptual agents:

```text
Dialogue Agent
      ↓
Semantic Parsing Agent
      ↓
Database Query
      ↓
Explanation Agent
```

This is a strong conceptual model.

Instead of one huge prompt:

> "You are a data analyst..."

use specialized stages.

Your architecture should follow the same principle.

---

# 11. Wren AI

Wren AI is especially relevant as an open-source GenBI architecture.

Its current repository describes:

- open-source GenBI;
- governed text-to-SQL;
- semantic layer;
- context layer;
- dashboard generation;
- multiple data sources.

### Key lesson

The hardest problem is not generating SQL.

The hardest problem is **giving the AI trustworthy context**.

Therefore invest heavily in:

- schema descriptions;
- column descriptions;
- relationships;
- metric definitions;
- business terminology;
- examples;
- synonyms;
- data quality metadata;
- query history;
- verified answers.

---

# 12. Apache Superset

Superset's newer MCP functionality is another important architectural signal.

AI clients can interact with Superset to:

- explore datasets;
- inspect dataset metadata;
- find charts;
- inspect dashboards;
- run SQL;
- create charts;
- create dashboards.

### Lesson

Your platform should expose its own **AI tool/API layer**.

Eventually external agents should be able to say:

```text
search_datasets()
get_dataset_schema()
search_metrics()
run_analysis()
create_chart()
create_dashboard()
get_dashboard()
```

This turns the platform from a UI into an analytics infrastructure layer.

---

# 13. Common Feature Set

The competitive set converges around these features.

## A. Data connectivity

### Required

- PostgreSQL
- MySQL
- SQLite
- CSV
- Excel
- Parquet
- JSON
- REST APIs

### Later

- ClickHouse
- Snowflake
- BigQuery
- MongoDB
- SQL Server
- Oracle
- S3
- Google Sheets
- SaaS APIs

---

# 14. Schema Discovery

When a user connects a database:

```text
Database
 ↓
Schemas
 ↓
Tables
 ↓
Columns
 ↓
Types
 ↓
Primary keys
 ↓
Foreign keys
 ↓
Indexes
 ↓
Sample values
```

Store metadata in your platform database.

Example:

```json
{
  "table": "orders",
  "description": "Customer orders",
  "columns": [
    {
      "name": "created_at",
      "type": "timestamp",
      "description": "Order creation time"
    },
    {
      "name": "amount",
      "type": "numeric",
      "description": "Gross order value"
    }
  ]
}
```

---

# 15. Business Context Layer

This should be one of your strongest differentiators.

Allow users to define:

### Metrics

```text
Revenue
Orders
Gross Margin
Active Customers
Churn
Conversion Rate
```

### Dimensions

```text
Country
Region
Product
Customer Segment
Salesperson
Channel
```

### Business definitions

```text
Revenue excludes refunded orders.

Active customer means a customer with at least
one successful transaction in the selected period.

MRR excludes one-time charges.
```

### Synonyms

```text
sales = revenue
buyers = customers
GM = gross margin
orders = successful orders
```

### Time definitions

```text
Fiscal year starts April 1.
Week starts Monday.
```

This prevents one of the biggest failures of generic AI analytics: **the answer can be syntactically correct but semantically wrong.**

---

# 16. AI Query Architecture

Do NOT build:

```text
User → LLM → SQL → Database
```

Build:

```text
                 ┌──────────────┐
                 │ User question│
                 └──────┬───────┘
                        ↓
               Intent classification
                        ↓
                Context retrieval
                        ↓
              Semantic interpretation
                        ↓
                 Query planning
                        ↓
                  SQL generation
                        ↓
                  SQL validation
                        ↓
                Safety validation
                        ↓
                  Query execution
                        ↓
                Result validation
                        ↓
              Analytical reasoning
                        ↓
                Visualization spec
                        ↓
                   Explanation
```

---

# 17. AI Agent Tools

The LLM should not directly have unrestricted database access.

Give it explicit tools.

Example:

```text
get_workspace_context()
search_datasets()
get_dataset_schema()
search_metrics()
get_metric_definition()
search_verified_queries()
generate_query_plan()
validate_query()
execute_readonly_query()
profile_result()
create_visualization()
save_chart()
create_dashboard()
get_dashboard()
```

The LLM chooses tools.

The backend enforces permissions.

---

# 18. Structured AI Output

AI should return structured objects rather than arbitrary text.

For example:

```json
{
  "intent": "trend_analysis",
  "dataset": "orders",
  "metrics": ["revenue"],
  "dimensions": ["month"],
  "filters": [
    {
      "field": "status",
      "operator": "eq",
      "value": "completed"
    }
  ],
  "time_range": "current_year",
  "visualization": {
    "type": "line",
    "x": "month",
    "y": "revenue"
  }
}
```

Use schema-constrained model output wherever possible.

OpenAI's Structured Outputs documentation specifically recommends schema-constrained outputs when applications need reliable structured responses and tool/function integration.

---

# 19. Query Safety

Every AI-generated query should pass:

### 1. SQL parser

Check syntax.

### 2. Read-only validator

Reject mutations.

### 3. Table permission validator

Check the user can access every table.

### 4. Cost validator

Reject or modify dangerous queries:

```text
SELECT * FROM 800M rows
```

### 5. Timeout

Example:

```text
5–30 seconds
```

depending on query class.

### 6. Row limit

Default:

```text
10,000 rows
```

for interactive exploration.

### 7. Query cancellation

Users must be able to stop expensive queries.

---

# 20. Result Validation

This is a major opportunity.

Do not assume:

```text
SQL executed successfully = answer is correct
```

After execution, analyze:

- empty result;
- suspiciously large result;
- duplicate rows;
- null explosion;
- unexpected date range;
- division by zero;
- missing periods;
- metric inconsistency;
- impossible values;
- join multiplication;
- statistical outliers.

Example:

```text
⚠ Potential issue

Revenue increased 280%.

However, the query joins orders to order_items
without aggregation and may duplicate order values.

Suggested validation:
COUNT(DISTINCT order_id)
```

This would be extremely valuable in real industry use.

---

# 21. Visualization Engine

Do not ask AI to generate arbitrary frontend code.

Generate a declarative visualization specification.

Example:

```json
{
  "type": "bar",
  "data_source": "query_182",
  "encoding": {
    "x": "region",
    "y": "revenue",
    "sort": "-y"
  }
}
```

Then the frontend renders it.

Vega-Lite is a strong reference architecture because it represents visualizations as a declarative JSON specification and compiles them into executable visualization definitions.

---

# 22. Dashboard Builder

A dashboard should be a collection of reusable analytical objects.

```text
Dashboard
 ├── KPI
 ├── Chart
 ├── Table
 ├── Text
 ├── AI Insight
 ├── Filter
 └── Alert
```

Each widget should have:

```text
query_id
visualization_spec
position
size
refresh_policy
filters
permissions
```

### AI dashboard generation

User:

> Create a sales dashboard for management.

AI creates:

```text
Revenue
Orders
Average Order Value
Revenue Trend
Revenue by Region
Top Products
Customer Growth
Refund Rate
AI Executive Summary
```

But the platform should explain why each widget was selected.

---

# 23. Industry-Oriented Differentiator: Decision Dashboards

Traditional dashboards answer:

> "What happened?"

Your platform should answer:

> "What happened, why, and does someone need to act?"

Example:

### Revenue

```text
₹42.3M
+8.4% MoM
```

### AI explanation

```text
Revenue grew 8.4% primarily due to:
- West region +18%
- Enterprise customers +14%

Growth was partially offset by:
- SMB churn
- higher refund rate
```

### Action signal

```text
ATTENTION

Refund rate increased from 2.1% → 4.8%.

Main contributor:
Product X
Region: West
```

This is much more useful than another chart builder.

---

# 24. AI Insight Engine

Every important dashboard should optionally have:

### Trend detection

```text
Revenue ↓ 12%
```

### Anomaly detection

```text
Refund rate is 3.1σ above normal.
```

### Change attribution

```text
68% of the revenue decline comes from Region A.
```

### Contribution analysis

```text
Product B explains 42% of the increase.
```

### Forecast

Optional later feature.

### Explanation

```text
Why did this change?
```

---

# 25. Alerts

Users should be able to say:

> Alert me if daily orders fall below 500.

or:

> Tell me if refund rate increases by more than 20%.

or:

> Alert the sales team if enterprise pipeline drops below ₹10M.

Architecture:

```text
Saved query/metric
       ↓
Scheduler
       ↓
Query
       ↓
Rule engine
       ↓
Condition met?
   ↓         ↓
  No        Yes
            ↓
        Notification
```

Channels:

- email
- in-app
- webhook
- Slack later
- Teams later

---

# 26. Data Quality

This should become a major industry feature.

For every dataset calculate:

```text
Completeness
Uniqueness
Validity
Freshness
Consistency
Volume
```

Example:

```text
orders

Freshness       ✓ 4 min ago
Completeness    ⚠ 96.2%
Duplicate rate  ⚠ 1.7%
Schema change   ✓
Volume          1.2M rows
```

Then AI can warn:

> "Revenue may be understated because 3.8% of orders have missing amount values."

This transforms the platform from visualization software into an operational data product.

---

# 27. Data Freshness

Every connected dataset should expose:

```text
Last updated
Expected update interval
Actual update interval
Freshness status
```

Example:

```text
Expected: every 15 minutes
Last update: 2 hours 17 minutes ago

⚠ DATA STALE
```

---

# 28. Data Lineage

For every dashboard widget show:

```text
Dashboard
 ↓
Chart
 ↓
Saved Query
 ↓
Metric
 ↓
Tables
 ↓
Source
```

Click:

> "Where does this number come from?"

and show the complete lineage.

This is critical for enterprise trust.

---

# 29. Answer Provenance

Every AI answer should have:

```text
Answer
↓
Sources
↓
Metrics
↓
Filters
↓
Query
↓
Execution time
↓
Data freshness
```

Example:

```text
Revenue: ₹12.4M

Based on:
orders table
Metric: Net Revenue
Period: 1–30 Sep 2026
Status: completed
Data updated: 8 min ago

View query
View lineage
```

---

# 30. Confidence Without Fake Precision

Do not show:

```text
AI confidence: 94%
```

unless you have a validated methodology.

Instead classify:

```text
Verified
Likely correct
Needs clarification
Data quality concern
Insufficient data
```

Example:

> **Needs clarification:** "Sales" could mean gross sales or net sales. The workspace defines both.

This is more useful than a fabricated probability.

---

# 31. Query Explanation

Every generated query should be explainable.

Example:

```text
I used:

orders.created_at
orders.amount
orders.status

I filtered:
status = completed

I grouped by:
month

I calculated:
SUM(amount)
```

---

# 32. Conversational Analysis

The conversation should preserve analytical state.

User:

> Show revenue by month.

Then:

> Only enterprise customers.

Then:

> Compare it with last year.

Then:

> Make that a dashboard.

The system should understand that "that" refers to the current analytical object.

State:

```text
Conversation
 ├── active dataset
 ├── active metrics
 ├── active filters
 ├── active dimensions
 ├── time range
 └── visualization
```

---

# 33. Saved Analysis

Everything useful should become reusable.

Objects:

```text
Question
Query
Metric
Chart
Dashboard
Alert
Insight
Dataset
```

A conversation should not be the final storage mechanism.

---

# 34. Workspace Architecture

Recommended hierarchy:

```text
Organization
 ├── Workspace
 │    ├── Data Sources
 │    ├── Datasets
 │    ├── Metrics
 │    ├── Questions
 │    ├── Charts
 │    ├── Dashboards
 │    ├── Alerts
 │    ├── Data Quality
 │    └── AI Context
```

---

# 35. Multi-Tenant Architecture

Design for multi-tenancy from the beginning even if the first version has one organization.

Every major table should have:

```text
organization_id
workspace_id
created_by
```

Use PostgreSQL/Supabase RLS as the authorization boundary.

Do not rely solely on frontend filtering.

---

# 36. Proposed Technical Architecture

```text
                    Browser
                       │
                 Vite + React
                 TypeScript
                 shadcn/ui
                       │
                       ▼
                FastAPI Gateway
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Auth/RBAC     AI Orchestrator  Query API
          │            │            │
          │            ▼            │
          │       Context Engine     │
          │            │             │
          │            ▼             │
          │      Semantic Layer      │
          │            │             │
          │            ▼             │
          │       Query Planner      │
          │            │             │
          │            ▼             │
          │       SQL Validator      │
          │            │             │
          │            ▼             │
          │      Query Execution     │
          │            │             │
          │       ┌────┴─────┐       │
          │       ▼          ▼       │
          │    DuckDB      Polars    │
          │       │          │       │
          │       └────┬─────┘       │
          │            ▼             │
          │      Result Profiler     │
          │            │             │
          └────────────┼─────────────┘
                       ▼
                 PostgreSQL
                  / Supabase
                       │
             metadata/config/auth
```

---

# 37. Role of Each Technology

## FastAPI

Use FastAPI for:

- API;
- authentication integration;
- query orchestration;
- AI orchestration;
- background job APIs;
- streaming;
- dashboard APIs;
- connectors;
- alert APIs.

FastAPI is well suited to this service-oriented API layer.

Reference:
https://fastapi.tiangolo.com/deployment/

---

## PostgreSQL / Supabase

Use Supabase/PostgreSQL for **application metadata**, not as the main analytical engine.

Store:

```text
users
organizations
workspaces
connections
datasets
columns
metrics
semantic_models
queries
charts
dashboards
dashboard_widgets
alerts
conversations
messages
audit_logs
data_quality_runs
```

Supabase provides authentication, PostgreSQL, APIs, storage and related infrastructure.

For self-hosting, Supabase officially supports Docker deployment and documents 4 GB RAM as a minimum and 8 GB+ recommended for the complete stack. Your 20 GB server is therefore feasible, although you should budget RAM across Supabase and your application services.

---

# 38. DuckDB

DuckDB should be your **analytical execution layer** for files and extracted/local datasets.

Use it for:

- CSV;
- Parquet;
- JSON;
- uploaded files;
- temporary analytical tables;
- joins between local/external datasets;
- analytical SQL;
- fast aggregations.

DuckDB can query Parquet directly and automatically push filters down to reduce the amount of data read.

It can also query remote HTTP(S) Parquet using range requests and partial reads.

References:

https://duckdb.org/docs/current/guides/file_formats/query_parquet

https://duckdb.org/docs/current/core_extensions/httpfs/https

---

# 39. Polars

Use Polars for:

- transformations;
- profiling;
- data cleaning;
- statistical calculations;
- feature generation;
- high-speed dataframe operations;
- advanced analytical operations that are easier to express in dataframe form.

Prefer the lazy API for pipelines that benefit from query optimization.

Reference:

https://docs.pola.rs/user-guide/concepts/lazy-api/

DuckDB and Polars integrate through Apache Arrow, so the two can work together efficiently.

Reference:

https://duckdb.org/docs/current/guides/python/polars

---

# 40. Vite + TypeScript + shadcn/ui

Frontend:

```text
Vite
React
TypeScript
shadcn/ui
Tailwind
```

Use:

- shadcn for application primitives;
- custom dashboard grid;
- chart library;
- command palette;
- data table;
- AI chat;
- query inspector;
- lineage viewer.

Do not make the entire product look like a generic shadcn admin template.

The main UX should be analytical and calm.

---

# 41. Visualization Recommendation

Use a declarative visualization specification.

Recommended initial approach:

```text
AI
 ↓
Visualization JSON
 ↓
Chart renderer
```

Potential renderer:

- Vega-Lite for highly declarative AI-generated charts;
- or ECharts for richer application-level interactions.

Vega-Lite's declarative JSON model is particularly attractive for AI because the model can produce a constrained visualization specification rather than arbitrary frontend code.

Reference:

https://vega.github.io/vega-lite/docs/

---

# 42. Data Source Architecture

Build a connector interface.

```python
class DataConnector:
    async def test_connection()
    async def discover_schemas()
    async def discover_tables()
    async def get_schema()
    async def execute_readonly()
    async def get_sample()
    async def profile()
```

Implement:

```text
PostgreSQLConnector
CSVConnector
ParquetConnector
ExcelConnector
MySQLConnector
RESTConnector
```

later:

```text
BigQueryConnector
SnowflakeConnector
ClickHouseConnector
MongoConnector
S3Connector
```

---

# 43. Do Not Copy the Competitors' Connector Strategy

A common trap is:

> "We need 40+ integrations."

No.

For the first product, optimize for:

### Tier 1

- PostgreSQL
- CSV
- Excel
- Parquet
- REST API

### Tier 2

- MySQL
- ClickHouse
- SQLite

### Tier 3

- BigQuery
- Snowflake
- MongoDB
- S3

The platform's internal dataset abstraction should make additional connectors inexpensive.

---

# 44. Query Execution Strategy

### Database-native mode

For connected SQL databases:

```text
User database
 ↓
Read-only connection
 ↓
Generated SQL
 ↓
DB execution
```

### Local analytical mode

For files:

```text
Upload
 ↓
Object/file storage
 ↓
DuckDB
 ↓
Polars
 ↓
Result
```

### Hybrid mode

Later:

```text
PostgreSQL
       +
CSV
       +
Parquet
       ↓
DuckDB
       ↓
Unified analysis
```

This can become a powerful feature.

---

# 45. Hybrid Data Analysis

Example:

> Compare our PostgreSQL orders with this uploaded Excel sales target.

System:

```text
PostgreSQL orders
        +
Excel targets
        ↓
DuckDB
        ↓
Join
        ↓
Actual vs Target
```

This is a practical industry workflow that many simple database chatbots do not solve elegantly.

---

# 46. AI Context Retrieval

Do not send the entire database schema to the LLM every time.

Build a context retrieval system.

```text
Question
  ↓
Keyword/semantic search
  ↓
Relevant datasets
  ↓
Relevant columns
  ↓
Relevant metrics
  ↓
Relevant business definitions
  ↓
Verified query examples
  ↓
Compact context
```

This reduces token usage and improves accuracy.

---

# 47. Semantic Layer Data Model

Minimum entities:

```text
Dataset
Field
Relationship
Metric
Dimension
Definition
Synonym
Filter
ExampleQuery
```

Example:

```yaml
metric:
  name: net_revenue
  label: Net Revenue
  expression: SUM(orders.amount - orders.refund_amount)
  filters:
    - status = completed
  description: Revenue after refunds
```

---

# 48. Verified Query Library

Every time an admin verifies an AI answer:

```text
Question
+
SQL
+
Metric mapping
+
Expected result behavior
```

store it.

Future questions can retrieve these examples.

This creates a company-specific analytical memory.

---

# 49. Human Feedback Loop

Allow:

```text
✓ Correct
✕ Incorrect
```

If incorrect:

```text
What was wrong?

[Wrong metric]
[Wrong table]
[Wrong filter]
[Wrong time period]
[Wrong interpretation]
[Other]
```

This feedback improves the workspace context.

---

# 50. Query Evaluation Framework

Create an internal benchmark.

For each test:

```text
Question
Expected interpretation
Expected SQL behavior
Expected metric
Expected filters
```

Example:

```text
Question:
"What was our net revenue last quarter?"

Expected:
metric = net_revenue
period = previous fiscal quarter
```

Every AI/model change runs the benchmark.

This is essential.

---

# 51. AI Provider Architecture

Do not hard-code one LLM.

Create:

```text
AIProvider
 ├── OpenAI
 ├── Anthropic
 ├── Gemini
 ├── OpenRouter
 ├── Ollama
 └── Local model
```

Use the model for reasoning, but keep deterministic validation in your application.

---

# 52. Model Routing

Not every task needs the most expensive model.

Example:

```text
Intent classification
→ cheap/fast model

Schema matching
→ cheap/fast model

SQL generation
→ strong model

Complex analytical reasoning
→ strong reasoning model

Summary
→ cheap model

Visualization formatting
→ structured output / small model
```

This reduces operating cost.

---

# 53. Caching

Cache:

```text
schema metadata
semantic context
query results
visualization specifications
AI responses where safe
```

But invalidate result cache when source freshness changes.

---

# 54. Background Jobs

Use a job system for:

- profiling;
- scheduled queries;
- alerts;
- data refresh;
- anomaly detection;
- dashboard refresh;
- connector sync;
- report generation.

Possible first implementation:

```text
FastAPI
+
Redis
+
RQ / Arq / Celery
```

Do not introduce Kafka at this stage.

---

# 55. Server Architecture for Your 20 GB / 4 CPU Machine

Your server:

```text
4 CPU
20 GB RAM
200 GB storage
Dokploy
```

is sufficient for an MVP and early production workload if you keep architecture lean.

Suggested rough allocation:

```text
Supabase/Postgres       3–5 GB
FastAPI                  1–2 GB
Worker                   1–2 GB
Redis                    0.5–1 GB
Frontend                 <0.5 GB
DuckDB/Polars            workload dependent
Monitoring               0.5–1 GB
OS/Docker overhead       2–3 GB
Headroom                 remaining
```

Do not run a large local LLM on this machine initially.

Use external model APIs or a separate inference server.

---

# 56. Dokploy Deployment

Recommended services:

```text
project-frontend
project-api
project-worker
project-redis
project-supabase
project-monitoring
```

Use separate Docker containers.

Do not put everything into one container.

---

# 57. Storage Strategy

200 GB is enough for an MVP but should not become the permanent raw-data lake.

Recommended:

```text
Postgres
  → metadata

Object storage
  → uploads/raw files

DuckDB
  → temporary analytical state

Parquet
  → processed analytical datasets
```

If storage grows, move object data to S3-compatible storage.

---

# 58. Security Model

Minimum:

### Authentication

Supabase Auth.

### Authorization

RBAC:

```text
Owner
Admin
Analyst
Viewer
```

### Database credentials

Encrypt at rest.

Prefer secret manager/environment secrets.

Never expose database credentials to the browser.

### AI database role

Read-only.

### Audit logs

Record:

```text
who
asked
what
query
tables
result metadata
when
```

---

# 59. Enterprise Security Roadmap

Later:

- SSO/SAML
- SCIM
- IP allowlisting
- private networking
- customer-managed keys
- audit export
- data residency
- row-level security
- column-level masking
- PII detection
- sensitive column policies

---

# 60. PII Protection

Automatically classify columns:

```text
email
phone
address
national_id
tax_id
bank_account
```

Then allow policies:

```text
AI can use column
AI can aggregate column
AI cannot display raw values
```

Example:

The AI can answer:

> "How many customers are from Gujarat?"

without being allowed to expose customer phone numbers.

---

# 61. Real Industry Workflows

The platform should be designed around workflows rather than generic charts.

## Sales

```text
Revenue
Pipeline
Conversion
Sales velocity
Rep performance
Region performance
```

## Finance

```text
Cash flow
Revenue
Expenses
AR aging
Refunds
Margin
```

## Operations

```text
Orders
Fulfillment
SLA
Backlog
Inventory
Failure rate
```

## Customer support

```text
Ticket volume
First response
Resolution time
SLA breaches
CSAT
Churn signals
```

## E-commerce

```text
GMV
AOV
Conversion
Refunds
Repeat purchases
Customer cohorts
```

The user can create an industry template and then map their own data.

---

# 62. Industry Templates

This could be a strong onboarding feature.

Example:

```text
Choose:

[ E-commerce ]
[ SaaS ]
[ Sales ]
[ Finance ]
[ Support ]
[ Operations ]
[ Manufacturing ]
[ Marketing ]
[ Custom ]
```

Then the platform suggests:

```text
metrics
dimensions
dashboards
alerts
data-quality rules
questions
```

This makes the product immediately useful.

---

# 63. AI Onboarding

Instead of:

> "Connect database."

Use:

```text
Welcome.

What do you want to monitor?

[Revenue]
[Customers]
[Operations]
[Finance]
[Custom]
```

Then:

```text
Connect data
 ↓
Scan schema
 ↓
Identify entities
 ↓
Suggest metrics
 ↓
Ask user to confirm
 ↓
Generate first dashboard
```

AI should ask for confirmation rather than silently invent business definitions.

---

# 64. First-Run Experience

Target:

### 5 minutes

User should be able to:

1. sign up;
2. connect PostgreSQL or upload CSV;
3. scan schema;
4. confirm suggested business concepts;
5. ask a question;
6. receive chart;
7. save dashboard.

---

# 65. Example UX

Landing screen:

```text
┌──────────────────────────────────────────┐
│ What do you want to know?                │
│                                          │
│ "Why did sales fall last month?"         │
│                                          │
│                    [Analyze →]           │
└──────────────────────────────────────────┘

Recent analyses

Revenue dashboard
Sales performance
Customer churn
```

Analysis view:

```text
Why did sales fall last month?

✓ Understanding question
✓ Checking business definitions
✓ Selecting relevant data
✓ Building query
✓ Validating result

Revenue fell 11.8%.

Main contributors:
1. West region       -₹1.2M
2. Product A         -₹0.7M
3. Enterprise churn -₹0.4M

[View query] [View data] [Create dashboard]
```

---

# 66. The "Why?" Engine

This should become a signature capability.

User:

> Why did revenue drop?

System should automatically perform:

```text
Total change
    ↓
Break down by:
  region
  product
  channel
  customer segment
    ↓
Find largest contributors
    ↓
Test contribution
    ↓
Return explanation
```

This is significantly more valuable than merely generating a revenue chart.

---

# 67. Root-Cause Analysis

A future root-cause engine can recursively investigate:

```text
Revenue ↓
    ↓
Orders ↓
    ↓
Conversion ↓
    ↓
Mobile conversion ↓
    ↓
Checkout error ↑
```

Then show:

```text
Likely driver:
Mobile checkout conversion decreased 18%.

Evidence:
Checkout errors increased 31% during the same period.
```

Important:

Use language such as:

```text
"associated with"
"largest observed contributor"
"possible driver"
```

unless causal evidence actually exists.

Do not claim causation merely from correlation.

---

# 68. Decision Briefs

Every dashboard can produce:

```text
Executive Brief

1. Revenue increased 8%.
2. Growth concentrated in enterprise.
3. Refunds increased 19%.
4. West region has the largest growth.
5. Product B has declining repeat purchases.

Attention:
Refund rate exceeded the configured threshold.
```

This converts dashboards into usable communication.

---

# 69. Scheduled Reports

Users can schedule:

```text
Daily 9:00 AM
Weekly Monday
Monthly 1st
```

Deliver:

- dashboard;
- PDF;
- CSV;
- executive summary;
- alert summary.

---

# 70. Embedded Analytics

Eventually expose:

```html
<SmartDataDashboard
  dashboard="sales"
  customer_id="123"
/>
```

Use signed context:

```text
customer_id
organization_id
role
filters
```

Backend enforces data access.

This creates a second business model:

> analytics infrastructure for SaaS companies.

Draxlr and AskYourDatabase demonstrate the value of this category.

---

# 71. MCP / Agent API

Build your own MCP server later.

Tools:

```text
search_data
get_schema
get_metrics
ask_data
run_query
create_chart
create_dashboard
get_dashboard
```

Then users can connect:

- ChatGPT;
- Claude;
- Cursor;
- other MCP clients.

This allows the platform to become a **data backend for AI agents**.

---

# 72. Recommended MVP

Do NOT build everything.

## MVP v1

### Data

- PostgreSQL
- CSV
- Excel
- Parquet

### AI

- natural-language questions
- schema-aware SQL generation
- follow-up questions
- SQL explanation
- result explanation

### Visualization

- KPI
- line
- bar
- area
- pie/donut
- table

### Dashboard

- drag/drop
- resize
- filters
- refresh
- sharing

### Trust

- SQL visibility
- read-only execution
- query validation
- data freshness
- source information

### Semantic layer

- metrics
- dimensions
- definitions
- synonyms

### Data quality

- null rate
- duplicate rate
- freshness
- row count

---

# 73. MVP v1.5

Add:

- alerts;
- anomaly detection;
- AI summaries;
- root-cause analysis;
- scheduled reports;
- hybrid database + file analysis;
- industry templates.

---

# 74. V2

Add:

- more connectors;
- embedded analytics;
- MCP;
- advanced RBAC;
- row-level security;
- lineage;
- audit;
- semantic search;
- API;
- multi-tenant SaaS billing.

---

# 75. Features to Avoid Initially

Do NOT start with:

- 50+ connectors;
- complex ETL;
- data warehouse;
- Kafka;
- Kubernetes;
- custom LLM;
- full Python notebook environment;
- massive dashboard marketplace;
- real-time streaming;
- complicated workflow engine.

These increase complexity before proving the core product.

---

# 76. Recommended Product Positioning

Avoid:

> "AI dashboard builder"

Too generic.

Avoid:

> "Chat with your database"

Too commoditized.

Better:

> **AI-powered business intelligence that explains what changed and why.**

Or:

> **Ask your business data. Verify the answer. Act on the insight.**

Or:

> **A simple data analyst for your business.**

The product should own the workflow:

```text
DATA
 ↓
UNDERSTANDING
 ↓
ANSWER
 ↓
EXPLANATION
 ↓
ACTION
```

---

# 77. Proposed Product Modules

```text
01 Home
02 Ask
03 Explore
04 Dashboards
05 Datasets
06 Metrics
07 Data Quality
08 Alerts
09 Insights
10 Connections
11 Semantic Layer
12 Settings
```

---

# 78. Suggested Frontend Navigation

```text
Home

Ask AI

Analytics
  ├── Explore
  ├── Charts
  └── Queries

Dashboards
  ├── My dashboards
  └── Shared

Data
  ├── Sources
  ├── Datasets
  └── Data quality

Business
  ├── Metrics
  ├── Definitions
  └── Relationships

Monitoring
  ├── Alerts
  ├── Anomalies
  └── Freshness

Admin
  ├── Members
  ├── Permissions
  ├── AI settings
  └── Audit
```

---

# 79. Database Schema — Initial

Core:

```text
organizations
workspaces
users
workspace_members
roles

data_sources
datasets
dataset_columns
dataset_relationships

metrics
dimensions
business_definitions
synonyms
verified_queries

queries
query_runs

charts
dashboards
dashboard_widgets

conversations
messages

alerts
alert_runs

data_quality_rules
data_quality_runs

insights
insight_evidence

audit_logs
```

---

# 80. Query Object

Example:

```json
{
  "id": "q_123",
  "workspace_id": "ws_1",
  "question": "Revenue by month this year",
  "semantic_plan": {},
  "sql": "SELECT ...",
  "data_sources": ["orders"],
  "status": "verified",
  "created_by": "user_1"
}
```

---

# 81. Dashboard Object

```json
{
  "id": "dash_1",
  "name": "Executive Sales",
  "widgets": [
    {
      "type": "metric",
      "query_id": "q_1"
    },
    {
      "type": "chart",
      "query_id": "q_2",
      "visualization": {}
    }
  ]
}
```

---

# 82. AI Agent State

```text
AgentState

question
intent
workspace_context
relevant_datasets
relevant_metrics
semantic_plan
query_plan
generated_sql
validation_results
execution_result
result_profile
visualization_spec
explanation
follow_up_options
```

Keep this state explicit.

Do not bury it inside a single giant prompt.

---

# 83. Query Lifecycle

```text
CREATED
  ↓
PLANNED
  ↓
GENERATED
  ↓
VALIDATED
  ↓
EXECUTED
  ↓
PROFILED
  ↓
EXPLAINED
  ↓
VISUALIZED
  ↓
SAVED
```

Failures:

```text
NEEDS_CLARIFICATION
INVALID_QUERY
PERMISSION_DENIED
DATA_QUALITY_WARNING
TIMEOUT
```

---

# 84. Observability

Monitor:

```text
AI latency
SQL latency
query failures
query cost
token usage
cache hit rate
connector failures
worker queue length
dashboard load time
```

AI-specific:

```text
SQL success rate
SQL correction rate
user thumbs-up rate
clarification rate
empty-result rate
semantic mismatch rate
```

These are product-quality metrics.

---

# 85. Business Success Metrics

Do not optimize only for:

```text
number of charts
number of dashboards
```

Track:

### Time-to-insight

```text
Question → trusted answer
```

### Answer acceptance

```text
% of answers users mark correct
```

### Rework rate

```text
How often users edit generated SQL
```

### Decision conversion

```text
Insights → saved dashboard/alert/action
```

### Data trust

```text
% of answers with verified provenance
```

---

# 86. Competitive Differentiation

The strongest product thesis is:

## Competitors

```text
Question
→ SQL
→ Chart
```

## Your platform

```text
Question
→ Business meaning
→ Verified metric
→ Query plan
→ Safe SQL
→ Validation
→ Result
→ Root-cause analysis
→ Explanation
→ Action
→ Monitoring
```

That is a much more defensible product.

---

# 87. The Three Core Product Pillars

## 1. SIMPLE

A non-technical user can ask:

> "Why are sales down?"

and get a useful answer.

## 2. TRUSTWORTHY

The user can inspect:

- metric;
- definition;
- SQL;
- source;
- freshness;
- filters;
- validation;
- lineage.

## 3. ACTIONABLE

The system can turn insight into:

- dashboard;
- alert;
- scheduled report;
- workflow;
- decision brief.

---

# 88. Architecture Principle

The most important architecture rule:

> **LLM decides; deterministic systems verify and execute.**

The LLM should decide:

```text
what the user means
which metrics matter
which analysis to perform
how to explain it
```

Deterministic application code should decide:

```text
what the user is allowed to access
whether SQL is safe
whether SQL is valid
how queries execute
how visualization renders
how permissions work
```

Never allow the LLM to become the security boundary.

---

# 89. Another Architecture Principle

> **Semantic context is more valuable than larger prompts.**

Invest in:

```text
definitions
metrics
relationships
examples
synonyms
lineage
permissions
quality metadata
```

before investing in elaborate prompt engineering.

---

# 90. Another Architecture Principle

> **Every AI answer should be reproducible.**

A saved answer should be linked to:

```text
question
context version
semantic model version
SQL
source version
execution timestamp
result metadata
model
```

If the answer changes tomorrow, users should be able to understand why.

---

# 91. Versioning

Version:

```text
semantic model
metric definitions
queries
dashboards
AI prompts
data sources
```

This is especially important for enterprise users.

---

# 92. Suggested Repository Structure

```text
smart-data-platform/
│
├── apps/
│   ├── web/
│   └── api/
│
├── packages/
│   ├── ui/
│   ├── types/
│   └── visualization/
│
├── services/
│   ├── query-engine/
│   ├── ai-orchestrator/
│   ├── profiler/
│   ├── alerts/
│   └── connectors/
│
├── infra/
│   ├── docker/
│   ├── dokploy/
│   └── supabase/
│
├── tests/
│   ├── ai/
│   ├── sql/
│   ├── semantic/
│   └── e2e/
│
└── docs/
```

For an early MVP, however, keep the backend as a modular monolith rather than prematurely splitting into many microservices.

---

# 93. Recommended Initial Backend

```text
FastAPI
 ├── auth
 ├── workspaces
 ├── connectors
 ├── metadata
 ├── semantic
 ├── query
 ├── ai
 ├── charts
 ├── dashboards
 ├── alerts
 └── audit
```

Separate workers only where asynchronous processing is required.

---

# 94. Development Phases

## Phase 0 — Foundation

- repo;
- Docker;
- Dokploy;
- Supabase;
- FastAPI;
- Vite;
- authentication;
- workspace model.

## Phase 1 — Data

- PostgreSQL connector;
- CSV;
- Parquet;
- schema discovery;
- dataset browser;
- DuckDB;
- Polars.

## Phase 2 — AI

- natural language;
- schema retrieval;
- semantic context;
- SQL generation;
- validation;
- execution;
- explanation.

## Phase 3 — Visualization

- KPI;
- table;
- line;
- bar;
- dashboard builder.

## Phase 4 — Trust

- provenance;
- freshness;
- data quality;
- SQL inspector;
- audit.

## Phase 5 — Intelligence

- anomaly detection;
- "why?" engine;
- root-cause analysis;
- AI summaries.

## Phase 6 — Operations

- alerts;
- scheduled reports;
- webhooks.

## Phase 7 — Platform

- embedding;
- MCP;
- API;
- advanced permissions.

---

# 95. MVP Acceptance Criteria

The MVP is successful when a new user can:

### Connect

```text
PostgreSQL
```

### Ask

```text
"Show revenue by month for this year."
```

### Receive

```text
SQL
+
chart
+
table
+
short explanation
```

### Follow up

```text
"Only enterprise customers."
```

### Ask why

```text
"Why did revenue fall in August?"
```

### Save

```text
Save to dashboard.
```

### Trust

```text
View source
View metric
View SQL
View freshness
```

### Monitor

```text
Alert me if revenue falls >10%.
```

If these work extremely well, the product has a foundation worth expanding.

---

# 96. What NOT to Promise

Avoid marketing:

> "Perfect AI SQL."

Avoid:

> "AI replaces data analysts."

Avoid:

> "100% accurate insights."

Instead:

> "AI-assisted analysis grounded in your data, definitions and permissions."

---

# 97. Recommended Product Name Concept

The name should communicate:

```text
data
clarity
intelligence
insight
signal
decision
```

The existing domain can determine the final naming strategy.

---

# 98. Final Product Vision

The end state should look like:

```text
                    YOUR BUSINESS DATA
                           │
             ┌─────────────┴─────────────┐
             │                           │
         Databases                     Files
             │                           │
             └─────────────┬─────────────┘
                           ↓
                    DATA UNDERSTANDING
                           │
                  Semantic / Business Layer
                           │
                           ↓
                      AI ANALYST
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
           Explore       Explain      Monitor
              │            │            │
              └────────────┼────────────┘
                           ↓
                    TRUSTED INSIGHT
                           │
              ┌────────────┼────────────┐
              ↓            ↓            ↓
          Dashboard       Alert       Action
```

The key is that **the dashboard becomes an output of intelligence, not the product itself.**

---

# 99. Recommended North Star

If this product is successful, a business owner should be able to open it and type:

> **"What needs my attention today?"**

The system should:

1. inspect relevant metrics;
2. check freshness;
3. detect meaningful changes;
4. identify anomalies;
5. investigate major contributors;
6. explain the findings;
7. show evidence;
8. recommend configured next actions;
9. let the user drill into the data.

That is substantially more valuable than:

> "Generate me a dashboard."

---

# 100. Reference Links

## Competitive products

- Chat2DB: https://chat2db.ai/
- Chat2DB AI Dashboard: https://chat2db.ai/feature/ai-dashboard-with-chat2db
- AskYourDatabase: https://www.askyourdatabase.com/
- AskYourDB: https://www.askyourdb.ai/
- Draxlr: https://www.draxlr.com/
- Draxlr AI docs: https://docs.draxlr.com/docs/ai
- DataReporter: https://www.datareporter.com/
- Metabase AI: https://www.metabase.com/features/metabase-ai
- Metabase AI docs: https://www.metabase.com/docs/latest/ai/overview
- Holistics AI: https://docs.holistics.io/docs/ai
- Hex AI: https://learn.hex.tech/docs/getting-started/ai-overview
- Seek AI: https://www.seek.ai/product-overview
- Wren AI: https://github.com/Canner/WrenAI
- Apache Superset AI: https://superset.apache.org/user-docs/using-superset/using-ai-with-superset/

## Technical references

- FastAPI deployment: https://fastapi.tiangolo.com/deployment/
- DuckDB guides: https://duckdb.org/docs/current/guides/overview
- DuckDB + Polars: https://duckdb.org/docs/current/guides/python/polars
- DuckDB Parquet: https://duckdb.org/docs/current/guides/file_formats/query_parquet
- DuckDB HTTP/S: https://duckdb.org/docs/current/core_extensions/httpfs/https
- Polars Lazy API: https://docs.pola.rs/user-guide/concepts/lazy-api/
- Vega-Lite: https://vega.github.io/vega-lite/docs/
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- Supabase Docker: https://supabase.com/docs/guides/self-hosting/docker
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs

---

# 101. Bottom Line

Build **less BI software** and **more data decision infrastructure**.

The winning loop should be:

```text
CONNECT
   ↓
UNDERSTAND
   ↓
ASK
   ↓
VERIFY
   ↓
EXPLAIN
   ↓
ACT
   ↓
MONITOR
```

Your proposed stack is well suited to this architecture:

```text
Vite + TypeScript + shadcn/ui
             ↓
          FastAPI
             ↓
     AI Orchestrator
             ↓
 Semantic / Business Layer
             ↓
     DuckDB + Polars
             ↓
PostgreSQL / External Sources
             ↓
      Supabase metadata/auth
```

The most important engineering investment should be the **semantic + validation layer**, not the chat UI.

The most important product investment should be **"Why did this change?" and "What needs attention?"**

The most important trust feature should be **provenance: show exactly how every important number was produced.**

The most important long-term moat should be the organization's accumulated:

```text
business definitions
+
verified queries
+
metrics
+
feedback
+
data-quality knowledge
+
analytical history
```

That is what turns a generic AI database chatbot into a genuine business data platform.


---

# 102. Visual Query Builder (added 2026-10-04)

**Goal:** a no-SQL, notebook-style builder that works on *any* table or dataset in the system (files, database tables, linked tables, derived datasets) and covers filtering, joining, reshaping, summarizing and window analytics, then hands off to charts, datasets and the SQL Workbench.

## 102.1 Research: how the alternatives do it
| Tool | What its builder does well | Gap we close |
|---|---|---|
| **Metabase** (notebook editor) | Linear steps: Data → Join → Custom column → Filter → Summarize → Sort → Limit; type-aware filters; per-step preview; "add another stage" (filter on a summary); results viewable as table/chart; stays one click from SQL | Joins only on a declared key picker, no window functions, no conditional metrics, no save-as-dataset |
| **Apache Superset** (Explore) | Many chart types, adhoc filters, metrics with custom SQL, time grain | Single dataset per chart; no joins in the UI; steep learning curve |
| **Looker / Holistics** | Semantic-layer drag and drop, reusable measures | Needs modelling first; not for ad-hoc tables |
| **Redash / Retool** | Quick parameterised SQL | Builder is limited or SQL-first |
| **Excel / Power Query** | Applied-steps list, running totals, pivots | Not database-native |

## 102.2 Design decisions
1. **One JSON spec, compiled server-side** (`services/qb.py`, `POST /api/qb/compile|run`). The UI never builds SQL strings; the compiler quotes every identifier, escapes every literal, refuses sub-queries inside expressions, and the result still goes through `validate_readonly`.
2. **Stages** (like Metabase's extra stage): each stage reads the previous one as a CTE, so "summarize, then filter / re-summarize / rank the summary" needs no SQL.
3. **Any table**: `GET /api/qb/schema` returns every dataset with typed columns plus join suggestions (declared relationships first, then same-name id/key columns).
4. **Beyond Metabase**: joins of any type (left/inner/right/full/cross) with multi-column keys; custom columns usable everywhere; 22 aggregates incl. percentiles, mode, null %; **conditional metrics** (`FILTER (WHERE ...)`); time/number bucketing; **window calculations** (running total, moving average, rank, change and % change vs previous, % of total, z-score, ntile, lag/lead); filters by regex, relative dates, custom SQL; distinct; sort; limit.
5. **Transparency**: the generated SQL is always shown, can be copied or sent to the Workbench as a notebook cell; per-stage preview.
6. **Hand-off**: Create chart (auto-guessed spec) · Save as dataset (derived dataset via `/transforms/derive`) · Open in Workbench.

## 102.3 Status
Done: compiler + API + tests (`backend/tests/test_qb.py`), page `/builder` (`features/query-builder/*`), AI layer (§102.4).
Next: pivot step, union/append, save/share builder questions, parameters, join-key preview with match rate, column profile popovers, drill-through from charts, "suggest the next step" chips from the current result.

## 102.4 AI in the builder (added 2026-10-05)
**Research.** Metabase's AI/Metabot, Superset's and Hex's assistants, Wren AI and our own D18/D21 all converge on the same safe shape: the model proposes a *structured* artifact, deterministic code validates and executes it, and the user can see and edit what was built. Free/reasoning models are slow and unreliable at exactly the simple cases people type most.
**Design (cheapest first).**
1. **Instant rules, no model** (`qb_rules.py`): "total revenue by category", "top 5 stores by profit", "orders per month", and edits of an open query ("only category is dark", "add the count", "sort by revenue ascending", "limit 20", "remove filters"). Used only when every part of the sentence is understood; typed values are matched to the column's real spelling.
2. **AI for everything else** (`qb_ai.py`): the model returns the builder's JSON spec (never SQL). `clean_spec` fixes what models really return, `compile_spec` quotes and guards it, a `LIMIT 0` bind-check catches bad columns, and up to two repairs are fed the real error. A safety net re-applies dropped "top N" / "by month" and rejects an answer that changed nothing.
3. **Formula helper**: describe a custom column in words, or "Fix with AI" on its error; validated on real rows; autocomplete of columns and ~95 functions while typing.
4. **Explain** (`qb_explain.py`): deterministic plain-English steps for any query. **Undo** restores the query from before each AI change.
**Measured** (default free model): simple requests 0.3 s; AI refinements 30-240 s and sometimes wrong, which is why rules come first. Next: stream progress, per-provider model choice for the builder, cache identical prompts.
