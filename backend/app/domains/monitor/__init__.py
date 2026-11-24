"""Monitor domain: alerts (metric rules, notifications) and scheduled reports (CSV exports, webhooks).

Public API: alerts.evaluate_alert / measure / scheduler_loop, reports.run_report / reports_loop,
alerts_api.router, reports_api.router. Other code imports from here, never the other way round.
"""
