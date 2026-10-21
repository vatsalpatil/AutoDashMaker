import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Activity, Bot, Database, LayoutDashboard, LogOut, ScrollText, Server, ShieldCheck, Users } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/features/auth/AuthProvider';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { OverviewPage } from './pages/OverviewPage';
import { UsersPage } from './pages/UsersPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { ActivityPage } from './pages/ActivityPage';
import { DataPage } from './pages/DataPage';
import { AiPage } from './pages/AiPage';
import { AuditPage } from './pages/AuditPage';
import { SystemPage } from './pages/SystemPage';

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/data', label: 'Data', icon: Database },
  { to: '/ai', label: 'AI', icon: Bot },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/audit', label: 'Audit trail', icon: ScrollText },
  { to: '/system', label: 'System', icon: Server },
];

/** Backoffice shell: checks /admin/me (ADMIN_EMAILS) before showing anything. */
export function BackofficeApp() {
  const me = useApi<{ email: string }>('/admin/me');
  const { email, signOut } = useAuth();
  if (me.loading && !me.data) return <Loading />;
  if (me.error) {
    // only a real "not an admin" answer says so; anything else (502 while the backend redeploys…) offers a retry
    const denied = /administrators only|^40[13]/i.test(me.error);
    return (
      <div className="grid h-screen place-items-center p-4">
        <EmptyState title={denied ? 'No backoffice access' : 'Server not reachable'}
          description={denied ? `${email ?? 'This account'} is not an administrator.` : `The backend did not answer (${me.error}). It may be restarting; try again in a moment.`}
          action={<button className="text-sm underline" onClick={denied ? signOut : me.reload}>{denied ? 'Sign out' : 'Try again'}</button>} />
      </div>
    );
  }
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-sidebar p-3 max-md:w-14">
        <div className="mb-4 flex items-center gap-2 px-2 py-1 font-semibold"><ShieldCheck className="size-5 text-primary" /><span className="max-md:hidden">Backoffice</span></div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent', isActive && 'bg-accent font-medium')}>
              <Icon className="size-4" /><span className="max-md:hidden">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t pt-3 text-xs text-muted-foreground">
          <div className="truncate px-2 max-md:hidden">{me.data?.email}</div>
          <button onClick={signOut} className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"><LogOut className="size-4" /><span className="max-md:hidden">Sign out</span></button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6 max-md:p-4">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:id" element={<UserDetailPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
