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
  /** true while the server is still running the deep dashboard scan; the fast report is already in `items`. */
  deep_pending?: boolean;
}

export interface Health {
  status: string;
  app: string;
  version: string;
}

/** GET /api/system: workspace health, storage, engine limits and cache, for Settings → System. */
export interface SystemInfo {
  app: string; version: string; python: string; uptime_s: number; auth_enabled: boolean; workspace: string;
  disk: { used_pct: number; limit_pct: number; free_gb: number; total_gb: number };
  files: { analytics_mb: number; metadata_mb: number; uploads_mb: number };
  limits: { memory: string; threads: number; query_timeout_s: number; max_upload_mb: number; default_row_limit: number };
  cache: { entries: number; max: number; ttl_s: number };
  counts: Record<string, number>;
}

/** GET /api/verify/status: where the signed-in user stands with email + mobile verification. */
export interface VerifyStatus {
  email: string; email_masked: string; email_verified: boolean;
  phone_masked: string; phone_verified: boolean;
  channels: { email: boolean; phone: boolean };
  missing: ('email' | 'phone')[]; complete: boolean;
  required: boolean; blocked: boolean; grace_ends_at: string;
  /** "console" = this server has no SMTP/SMS provider yet, so codes only appear in its log */
  delivery: { email: 'smtp' | 'console'; phone: 'twilio' | 'console' };
}
/** Answer of POST /verify/change/start: a code went to the new value and one to the account's other verified contact. */
export interface ContactChangeStarted { new: VerifySent; proof: VerifySent }
export interface VerifySent { sent: boolean; channel: 'email' | 'phone'; to: string; expires_in_s: number; resend_in_s: number; delivery: string; dev_code?: string }
