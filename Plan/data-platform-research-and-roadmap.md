# Data Lake · Delta Lake · DuckLake · Databricks · dbt: a teardown, and the Dashtor roadmap

Written 2026-10-19. Part 1 takes each tool apart: what problem it solves, how it works inside, and where it stops.
Part 2 is an honest audit of Dashtor. Part 3 is the plan that brings the useful ideas into Dashtor.

---

## Part 1. How each tool really works

### 1. Data lake: the problem everything else reacts to
- **What it is:** cheap object storage (S3, ADLS, GCS, or a local folder) that holds raw files: CSV, JSON, Parquet, logs, images. There is no server and no schema: you write files and decide what they mean when you read them ("schema on read").
- **Problem it solved:** warehouses (Teradata, then Redshift) were expensive, rigid and handled only tables. Lakes store everything at about $20 per TB per month and let any engine (Spark, Presto, DuckDB) read it.
- **Real logic:** a "table" is just a folder of files plus a naming convention (Hive partitions such as `year=2024/month=05/`). Readers list the folder and read whatever is there.
- **Why it fails on its own (the "data swamp"):**
  - No transactions. A reader can list the folder while a writer is halfway through, and see half-written data.
  - No updates or deletes. To change one row you rewrite whole files, so GDPR deletes are painful.
  - No schema enforcement. One bad file with a renamed column breaks every reader.
  - Listing millions of files on S3 is slow, so queries spend seconds just finding the data.
  - No history, no audit trail and no clear owner.
- **Takeaway:** storage and compute are separate, open formats are used, and it is cheap. Correctness is missing.

### 2. Delta Lake (Databricks, 2019; also Apache Iceberg and Apache Hudi)
- **Problem:** add database guarantees (ACID transactions) to a data lake without giving up open files and cheap storage.
- **Real logic: a transaction log next to the data.**
  - Data stays as Parquet files. Beside them sits `_delta_log/`, holding numbered JSON commits (`000…01.json`). Each commit lists actions: `add file X`, `remove file Y`, `metaData` (schema), `commitInfo`.
  - **The table's current state = replay the log** = the set of files that were added and never removed. Readers stop listing folders; they read the log.
  - **Atomic commit = optimistic concurrency.** The writer writes its Parquet files first, then tries to create log file N+1 with a "put if absent" write. If another writer already created it, the writer checks for conflicts and retries. Readers never see half a write, because files that are not in the log do not exist for them.
  - Every 10 commits a **checkpoint** (a Parquet summary of the log) is written, so replay stays fast.
  - **Time travel:** to read version 5, replay the log up to commit 5. Old files are kept until `VACUUM` removes them.
  - **Per-file statistics** (min/max per column) in the log enable **data skipping**: `WHERE date = '2024-05-01'` opens only the files whose range covers that date. `Z-ORDER` / liquid clustering lays rows out so the skipping works well.
  - **MERGE / UPDATE / DELETE** = rewrite only the affected files, add and remove them in one commit. Deletion vectors avoid even that rewrite.
  - **Schema enforcement and evolution:** a write with a mismatched schema is rejected unless `mergeSchema` allows it.
  - **Change Data Feed:** the row-level changes between versions, which downstream jobs can process incrementally.
- **Iceberg** does the same thing with a tree of metadata files (metadata.json → manifest list → manifests). It adds hidden partitioning and is the most engine-neutral (Snowflake, BigQuery, Trino, DuckDB). **Hudi** focuses on upserts and streaming ingestion.
- **Limits:** the log is still files on object storage. Commit throughput is limited (a few commits per second per table). Many small writes produce many small files and many log entries, which you have to compact. Multi-table transactions are not possible. A separate catalog (Unity, Glue, Polaris) is needed just to find the tables.

### 3. DuckLake (DuckDB Labs, 2025)
- **Problem:** Delta and Iceberg rebuilt a database's metadata out of files on S3, and that is complicated and slow (many small JSON/Avro files, then a catalog server on top anyway).
- **Real logic: put the metadata in an actual SQL database.**
  - The catalog and every snapshot, file list, schema version and column statistic live in ordinary tables (`ducklake_snapshot`, `ducklake_data_file`, `ducklake_table`, `ducklake_column`…) in Postgres, MySQL, SQLite or DuckDB.
  - Data is still plain Parquet files in any folder or bucket.
  - A commit = one SQL transaction in the catalog database. That gives **multi-table ACID**, high commit rates and immediate consistency, without any log replay.
  - Time travel = `SELECT … AT (VERSION => 3)`; snapshots are rows. Schema evolution, data inlining (tiny writes go into the catalog, not new files), encryption, and compaction (`ducklake_merge_adjacent_files`) are all there.
  - Usage: `ATTACH 'ducklake:postgres:dbname=…' AS lake (DATA_PATH 's3://…')`, after which it is a normal DuckDB database.
- **Why it matters to us:** Dashtor already runs DuckDB, Parquet and a metadata database. DuckLake is the lakehouse that fits our stack exactly.
- **Limits:** young (v0.x); its ecosystem is mostly DuckDB, while Spark and Trino support is early; one catalog database is a single point of failure, which a managed Postgres handles.

### 4. Databricks: the platform built around Spark and Delta
- **Problem:** companies were stitching together a lake, Spark clusters, notebooks, ML tools, a BI warehouse, permissions and job schedulers themselves. Databricks sells all of it as one product: the **"lakehouse"**.
- **Real logic (its layers):**
  1. **Storage:** Delta tables in the customer's own cloud bucket.
  2. **Compute:** managed Spark clusters plus **Photon** (a C++ vectorized engine), and serverless SQL warehouses.
  3. **Unity Catalog:** a single catalog for tables, files, ML models and permissions, with row and column security, column-level lineage, auditing and tags.
  4. **Workloads:** collaborative notebooks (Python, SQL, Scala), Workflows/Jobs (DAG scheduling), Delta Live Tables / Lakeflow (declarative pipelines with **expectations**, i.e. data-quality rules), Auto Loader (incremental file ingestion), Structured Streaming.
  5. **Machine learning and AI:** MLflow (experiments, model registry), Feature Store, Model Serving, Vector Search, Mosaic AI agents.
  6. **BI:** Databricks SQL, AI/BI dashboards, **Genie** (natural-language questions over the data, grounded in Unity Catalog metadata and "trusted assets").
  7. **Sharing:** Delta Sharing, an open protocol for sharing live tables across organizations.
- **Why people pay:** one copy of the data serves engineering, analytics and ML; strong governance; it scales to petabytes.
- **Limits:** expensive (DBUs on top of cloud costs); heavy for small teams; clusters take minutes to start; complicated (the concepts can take months to learn); BI and ad-hoc analysis feel worse than in a dedicated BI tool; it is massive overkill below roughly 1 TB.

### 5. dbt (data build tool)
- **Problem:** SQL transformations inside warehouses were a mess of copy-pasted scripts with no tests, no documentation, no dependency order and no version control.
- **Real logic: a compiler plus a runner for SELECT statements.**
  - A **model** = one `.sql` file holding one SELECT. dbt wraps it in `CREATE TABLE/VIEW AS`. You never write DDL yourself.
  - `{{ ref('orders') }}` and `{{ source('shop','raw_orders') }}` are Jinja functions. They resolve to real table names **and record a dependency edge**. The edges form a **DAG**, so dbt knows the run order, can run in parallel and gives lineage for free.
  - **Materializations:** view, table, **incremental** (only process new rows: `WHERE updated_at > (SELECT max(updated_at) FROM {{ this }})`, then merge), ephemeral (inlined as a CTE), snapshot (SCD Type 2 history of a changing table).
  - **Tests:** `unique`, `not_null`, `accepted_values`, `relationships`, plus custom SQL tests. A test is a query that should return 0 rows.
  - **Docs:** descriptions in YAML plus the DAG, rendered as a website. **Semantic layer (MetricFlow):** metrics defined once in YAML and queryable from any BI tool.
  - Everything is code in git: pull-request review, CI, environments (dev, prod), `state:modified+` (rebuild only what changed and what depends on it).
- **Why it won:** it brought software engineering (version control, tests, modularity, review) to SQL analysts, the "analytics engineer" role.
- **Limits:** it only transforms (the T in ELT). It does not ingest data, store it, schedule runs (that needs dbt Cloud or Airflow), draw charts or run Python well. It needs a warehouse to run on, and Jinja gets messy at scale.

### 6. Why you need several of them, and why none does everything
| Layer | Data lake | Delta / Iceberg | DuckLake | dbt | Databricks |
|---|---|---|---|---|---|
| Cheap open storage | ✅ | ✅ (uses a lake) | ✅ (uses a lake) | ❌ | ✅ (Delta) |
| ACID, time travel | ❌ | ✅ | ✅ multi-table | ❌ | ✅ |
| Catalog | ❌ | needs an external one | ✅ built in | ❌ | ✅ Unity |
| Compute engine | ❌ | ❌ (a format) | uses DuckDB | uses the warehouse | ✅ Spark/Photon |
| Transformation modelling, tests, DAG | ❌ | ❌ | ❌ | ✅ | 🔶 DLT |
| Ingestion | ❌ | ❌ | ❌ | ❌ | 🔶 Auto Loader |
| BI, dashboards, natural-language questions | ❌ | ❌ | ❌ | ❌ | 🔶 AI/BI, Genie |
| Fit for small teams, cost | ✅ | 🔶 | ✅ | ✅ | ❌ |

- These are **layers, not competitors**. Storage (lake) → table format (Delta/Iceberg/DuckLake) → engine (Spark/DuckDB) → modelling (dbt) → semantic layer → BI/AI.
- None does everything because each is optimised for a different trade-off. A table format must stay engine-neutral, so it cannot have an engine. dbt is valuable because it is "just SQL in git" on any warehouse, so it cannot own storage. Databricks does try to do everything, and pays for it in cost, complexity and weak BI.
- **The gap:** no product gives a 1–20 person team a lakehouse with transactions and time travel, dbt-style tested models, a semantic layer and AI-first BI in one tool that is light, cheap and works without engineers. **That is the space Dashtor can own.** DuckDB/DuckLake makes it possible on a single server.

---

## Part 2. Dashtor teardown

### What Dashtor is good at
1. **End-to-end in one app:** connect → dataset → query → chart → dashboard → share, plus alerts and reports. Databricks needs 4+ products to do this; dbt does one step.
2. **AI-native:** natural-language Ask, an SQL agent, AI dashboard generation (understand → plan → build, streamed), chat editing, "Why did this change", decision briefs. Explanations are deterministic, so they can be audited.
3. **Modern core:** DuckDB with Parquet storage (zstd), a sqlglot read-only SQL guard, a result cache, query timeouts.
4. **Broad ingestion:** files, Postgres, MySQL, SQLite, REST, GraphQL, Google Sheets, URLs, live links or copies, plus API Studio.
5. **Governance pieces:** quality scores, lineage (dashboard → source), audit log, secrets encrypted at rest, per-user isolation, quotas, SSRF guards.
6. **Semantic layer:** metrics, dimensions, synonyms and verified queries feed the AI.
7. **Cheap to run:** one process on one VM (Dokploy on Oracle).

### Faults, ranked by impact
1. **Datasets had no history.** A refresh overwrote the Parquet file, so a bad source pull silently broke every dashboard with no undo. *(Fixed in this session: dataset versions, see below.)*
2. **Transforms are not a real model DAG.** Derived datasets replay their own pipeline, but there is no `ref()`-style dependency graph: refreshing a base dataset does not rebuild the datasets built from it, there is no run order and no "rebuild everything downstream".
3. **No data tests or contracts.** The quality score is descriptive. There are no assertions (not null, unique, accepted values, relationships, freshness) that **block** a bad refresh or raise an alert.
4. **Full reloads only.** Every refresh copies the entire source. There is no incremental (watermark) or merge/upsert mode, which is slow and costly for big tables.
5. **One database file per user, single writer.** It does not scale across processes. Each metadata write opens a connection (about 50 ms). There is no open table format that other tools could read.
6. **Lineage stops at the dataset.** There is no column-level lineage and no "impact analysis" (which charts break if I drop this column).
7. **Semantic layer is not versioned** and not used everywhere (charts and alerts selectors ignore metrics).
8. **No export or interoperability:** a user cannot point dbt, Python or another BI tool at their Dashtor data. It is locked in.
9. **Ops gaps:** tests are plain scripts with no CI; the frontend needs manual deploys; the free model is inconsistent; one process means a long AI call can starve refreshes.
10. **No roles:** single-user workspaces only; no team sharing of sources or models, and no row-level security.

---

## Part 3. Roadmap: Dashtor as the single small-team lakehouse plus AI BI

Principle: take the **idea** from each tool, implement it in the simplest possible way on DuckDB and Parquet, and hide the complexity behind the AI and the UI. Ordered so each step stands alone and can ship on its own.

### Phase A: Trust the data (Delta ideas)
- **A1. Dataset versions and time travel (✅ DONE 2026-10-19).** Each refresh keeps the previous Parquet file (the last 3, counted in the quota and dropped first when space runs out). `GET /api/datasets/{id}/versions`, `…/{v}/preview`, `POST …/{v}/restore` (a restore is itself undoable). UI: dataset page → **Versions** tab. Code: `services/versions.py`, `routers/dataset_versions.py`, `features/datasets/VersionsPanel.tsx`, `tests/test_versions.py`.
- **A2. Change summary per version:** row count change, schema diff (columns added, removed or retyped) and a sample of changed keys, shown in the Versions list and fed to "Why did this change".
- **A3. Schema enforcement on refresh:** if a refresh drops or retypes a column that charts use, keep the old version live and raise an alert, instead of breaking dashboards. Uses A1 plus lineage.
- **A4. Retention setting** per dataset (versions to keep, or days), shown in Settings → usage.

### Phase B: Tested models (dbt ideas)
- **B1. Model DAG:** derived datasets declare their parents (`ref` = a dataset id). Store the edges in a `dataset_deps` table. Refreshing a dataset refreshes its descendants in topological order (the refresh loop already exists). Show the DAG in the lineage view.
- **B2. Data tests:** a `dataset_tests` table with the types not_null, unique, accepted_values, range, relationships, freshness and custom SQL (each a query that must return 0 rows, validated by `validate_readonly`). Run them after each refresh; a failing **error**-level test restores the previous version automatically (A1) and alerts. The AI suggests tests from the profile ("order_id looks unique, add a test?").
- **B3. Incremental refresh:** an optional watermark column per dataset. Fetch only `> max(watermark)` and append, or merge on a key (`INSERT OR REPLACE` / an anti-join, then write a new Parquet file). Big database tables refresh in seconds.
- **B4. Snapshots (SCD2)** for slowly changing tables: `valid_from` / `valid_to` columns maintained on refresh.
- **B5. Model docs:** column descriptions (the AI drafts them, the user confirms) used by Ask, the agent and the Guide.

### Phase C: An open lakehouse (DuckLake ideas)
- **C1. Optional DuckLake storage backend:** keep `columnar.py` as the only interface, and add a `DUCKLAKE=on` setting that stores datasets as DuckLake tables (catalog in the per-user metadata DuckDB or Postgres, data in the parquet folder or S3). That gives multi-table ACID, real `AT (VERSION =>)` time travel and compaction for free, and replaces A1's file copies.
- **C2. Read-only external access:** per-user tokens so Python, dbt-duckdb or another BI tool can read your data (Parquet export, or an Arrow Flight / Postgres-wire endpoint later). This removes the lock-in.
- **C3. Object storage:** S3-compatible data path (Oracle Object Storage, R2) so disk stops being the limit.

### Phase D: Governance and semantics (Unity Catalog ideas)
- **D1. Column-level lineage** from sqlglot (we already parse every query) → impact analysis before deleting or renaming a column.
- **D2. Versioned semantic layer**, used by charts, alerts and dashboards (single source of metric truth, as MetricFlow does).
- **D3. Teams and roles:** shared workspaces (viewer, editor, admin), row-level filters per role.
- **D4. Tags and classification:** PII detection on profiling, masking in shares and in AI prompts.

### Phase E: Pipelines and AI (Databricks Lakeflow + Genie ideas)
- **E1. Jobs view:** one place for refreshes, tests, reports and alerts with run history, durations and retries (we have the loops; add a `job_runs` table and a page).
- **E2. Expectations in the transform builder** (Delta Live Tables style: drop, warn or fail rows).
- **E3. Genie-grade Ask:** ground answers in verified queries, tests, descriptions and metrics, with a confidence badge. Add a model router (cheap model for simple wording, strong model for SQL) and run the NL→SQL eval in CI.
- **E4. Separate the background worker** from the web process (or a job queue), so AI calls never block refreshes.

### What not to build (avoid the Databricks trap)
Spark, clusters, notebooks for distributed ML, streaming at millions of events per second, multi-cloud. Dashtor wins by being **one light app that a non-engineer can run**, while staying open (Parquet/DuckLake) so it can grow into the heavy tools if a team ever needs them.

### Order of work
A1 ✅ → B2 (tests + auto-rollback, the biggest gain in trust) → A2/A3 → B1 (DAG) → B3 (incremental) → E1 (jobs page) → D1 → C1 (DuckLake) → the rest.
