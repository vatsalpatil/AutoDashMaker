export interface Report {
  id: string; name: string; sql: string; schedule_minutes: number; active: boolean; webhook_url: string;
  last_run_at?: string | null; last_status: string; last_rows?: number | null;
}
export interface ReportRun { id: string; status: string; row_count: number; message: string; file_name: string; created_at: string }
