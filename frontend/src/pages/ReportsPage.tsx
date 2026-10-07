import { ErrorBanner } from '@/components/common/ErrorBanner';
import { Loading } from '@/components/common/Loading';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/ui/kit';
import { ReportCard } from '@/features/reports/ReportCard';
import { ReportForm } from '@/features/reports/ReportForm';
import type { Report } from '@/features/reports/types';
import { useApi } from '@/hooks/useApi';

/** Scheduled reports: a saved query that runs on an interval, keeps each result as a CSV and notifies you. */
export default function ReportsPage() {
  const reports = useApi<Report[]>('/reports');
  if (!reports.data) return reports.error ? <ErrorBanner message={reports.error} /> : <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Reports" description="Run a query on a schedule, keep every result as a CSV, and get notified (or POST a summary to a webhook)." />
      <ReportForm onCreated={reports.reload} />
      {reports.data.length === 0
        ? <EmptyState title="No reports yet" description="Create one above." />
        : reports.data.map((r) => <ReportCard key={r.id} report={r} onChanged={reports.reload} />)}
    </div>
  );
}
