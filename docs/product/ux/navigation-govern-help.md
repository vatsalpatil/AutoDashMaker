# Navigation IA + Govern/Help pages

## IA analysis
Old groups: Work (8 items) / Govern / Help. "Work" mixed every step of the workflow; "Govern" mixed
monitoring (Alerts, Reports) with data-health (Quality) and audit (Activity). Order did not follow
Connect -> Explore -> Define -> Visualize -> Monitor.

New groups (same routes, same labels): **Start** (Home, Ask) · **Connect** (Data Sources, Quality) ·
**Explore** (Workbench, Query Builder) · **Define & visualize** (Key Numbers, Charts, Dashboards) ·
**Monitor** (Alerts, Reports, Activity) · **Help** (Guide, Settings). Each item has a one-line `hint`
shown in the sidebar tooltip.

## Competitor patterns (official docs, checked 2026-11-19)
- **Metabase**: alerts go on a *question* and send by email, Slack or webhook. They fire on any result or when a goal line is crossed. Dashboard subscriptions are opened from the dashboard's menu. Admins see every alert and subscription under Admin > Audit.
  [alerts](https://www.metabase.com/docs/master/questions/sharing/alerts) · [subscriptions](https://www.metabase.com/docs/latest/dashboards/subscriptions)
- **Power BI service**: the left nav runs Home > Browse > OneLake catalog/data hub > Create (Get Data moved here) > Workspaces. Monitor is a hub that shows only for some roles, licences or tenants. The order moves from finding things to making things to watching them.
  [end-user experience](https://learn.microsoft.com/power-bi/consumer/end-user-experience) · [Fabric Home](https://learn.microsoft.com/en-us/fabric/get-started/fabric-home)
- **ThoughtSpot**: Monitor is its own tab. It offers anomaly (the default), threshold, scheduled and attribute alerts on KPI charts, plus webhooks.
  [Monitor](https://docs.thoughtspot.com/cloud/latest/monitor) · [threshold](https://docs.thoughtspot.com/cloud/latest/monitor-alert-threshold)
- **Lightdash**: a scheduled delivery is created from the menu of a chart or dashboard. Project Settings > Syncs & Scheduled Deliveries lists every delivery with its status, history and "Send now".
  [create](https://docs.lightdash.com/explore/create-scheduled-deliveries) · [alerts](https://docs.lightdash.com/explore/create-alerts)
- **Soda Cloud**: each dataset has its own dashboard with tabs (Checks, Anomalies). There is also an organisation-wide Checks list and a health score (failing checks out of all checks). Checks are added from the dataset itself.
  [dataset dashboard](https://docs.soda.io/soda-v4/manage-issues/dataset-dashboard) · [browse checks](https://docs.soda.io/manage-issues/browse-checks)
- **Pattern**: items are created where the content lives (chart, dashboard, dataset), and one central list manages them all. Quality sits next to the data.

## Differences vs Dashtor
- Dashtor creates alerts and reports from central pages only. There is no "alert on this chart" entry point.
- Quality used to sit under "Govern", away from Data Sources. Every tool above keeps quality next to the dataset.
- No alert types beyond threshold, such as anomaly or "any result".

## Chosen
1. Workflow-ordered groups (above) - matches the mental model; zero route changes.
2. Tooltip hints per nav item - teaches what each page is for, even when collapsed.
3. Explanatory empty states for Alerts, Reports and Quality: what each one does and how to make the first one. The Reports text matches the form (every N minutes, CSV, optional webhook).
4. Settings: a page header, plus a one-line description of the active tab.
5. Guide: a new "End-to-end workflow" section built from nav.ts, so it can't drift from the sidebar.
6. The landing ProductExplorer uses the same groups as the sidebar.

## Rejected / deferred
- Renaming pages (e.g. Key Numbers -> Metrics): other pages/docs link by label; too risky in parallel work.
- Moving Settings to a footer/avatar menu (Metabase/Power BI style): nice, but touches auth UI.
- "Create alert / subscribe" entry points on charts & dashboards: owned by other agents; recommended next.
- Quality incidents feed (Monte Carlo style): needs backend.
