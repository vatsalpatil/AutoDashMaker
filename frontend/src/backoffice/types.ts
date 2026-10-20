// Shapes returned by /api/admin (backend/app/routers/admin.py)
export interface AdminUser {
  id: string; email: string | null; workspace_id: string; provider: string | null;
  created_at: string | null; last_sign_in_at: string | null; last_active_at: string | null;
  email_confirmed: boolean; banned_until: string | null; suspended: boolean; ai_calls_30d: number;
  datasets: number; dashboards: number; datasources: number; charts: number; queries: number; alerts: number;
}
export interface AdminUserDetail extends AdminUser {
  storage_bytes: number;
  datasets_list: { id: string; name: string; row_count: number | null; created_at: string; refreshed_at: string | null }[];
  dashboards_list: { id: string; name: string; created_at: string; updated_at: string }[];
  ai_by_model: { provider: string; model: string; calls: number; tokens_in: number; tokens_out: number; errors: number }[];
}
export interface ActivityRow {
  id: string; user_id: string | null; email: string | null; method: string; path: string;
  status: number; ms: number; ip: string; user_agent: string; created_at: string;
}
export interface Overview {
  totals: Record<string, number>; workspaces: number;
  activity: { requests_24h: number; users_24h: number; users_7d: number; errors_24h: number; p95_ms_24h: number | null };
  ai: { calls_24h: number; tokens_24h: number; errors_24h: number };
  daily: { day: string; requests: number; users: number; errors: number }[];
  ai_daily: { day: string; calls: number; tokens: number }[];
  top_paths: { method: string; route: string; n: number; avg_ms: number }[];
  recent_errors: Omit<ActivityRow, 'id' | 'user_id' | 'ip' | 'user_agent'>[];
  disk: { total: number; used: number; free: number };
}
