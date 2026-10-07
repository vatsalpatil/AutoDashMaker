/** Alerts, notifications, audit log, attention report, health. Re-exported from lib/types (index.ts). */

export type AlertOperator = 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'pct_up_gt' | 'pct_down_gt';

export interface Alert {
  id: string;
  name: string;
  dataset_id: string;
  metric_sql: string;
  operator: AlertOperator;
  threshold: number;
  schedule_minutes: number;
  channel?: string;
  active: boolean;
  last_run_at?: string | null;
  last_value?: number | null;
  last_status?: 'ok' | 'triggered' | 'error' | null;
  created_at?: string;
}

export interface AlertRun {
  id: string;
  alert_id: string;
  value?: number | null;
  status: 'ok' | 'triggered' | 'error';
  message?: string | null;
  created_at?: string;
  ran_at?: string;
}

export interface AlertRunResult {
  alert_id: string;
  value?: number | null;
  previous_value?: number | null;
  status: 'ok' | 'triggered' | 'error';
  message?: string | null;
}

export interface AppNotification {
  id: string;
  alert_id?: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface AuditItem {
  id: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  detail?: string | null;
  status: 'ok' | 'error' | 'blocked' | string;
  duration_ms?: number | null;
  created_at: string;
}

export interface AttentionItem {
  severity: 'high' | 'medium' | 'low';
  category: 'alert' | 'freshness' | 'quality' | 'anomaly';
  title: string;
  detail: string;
  link: string;
}

export interface AttentionReport {
  generated_at: string;
  all_clear: boolean;
  summary: { high: number; medium: number; low: number };
  items: AttentionItem[];
  scope: string;
}

export interface Health {
  status: string;
  app: string;
  version: string;
}
