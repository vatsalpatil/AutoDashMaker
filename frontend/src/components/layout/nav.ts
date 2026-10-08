import {
  BarChart3, BookOpen, Bell, Database, HelpCircle, FileClock, History, Home, LayoutDashboard, Settings, ShieldCheck, Sparkles, TerminalSquare, Blocks,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; group: 'Work' | 'Govern' | 'Help' }

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true, group: 'Work' },
  { to: '/ask', label: 'Ask', icon: Sparkles, group: 'Work' },
  { to: '/sources', label: 'Data Sources', icon: Database, group: 'Work' },
  { to: '/workbench', label: 'Workbench', icon: TerminalSquare, group: 'Work' },
  { to: '/builder', label: 'Query Builder', icon: Blocks, group: 'Work' },
  { to: '/metrics', label: 'Metrics', icon: BookOpen, group: 'Work' },
  { to: '/charts', label: 'Charts', icon: BarChart3, group: 'Work' },
  { to: '/dashboards', label: 'Dashboards', icon: LayoutDashboard, group: 'Work' },
  { to: '/alerts', label: 'Alerts', icon: Bell, group: 'Govern' },
  { to: '/reports', label: 'Reports', icon: FileClock, group: 'Govern' },
  { to: '/quality', label: 'Quality', icon: ShieldCheck, group: 'Govern' },
  { to: '/activity', label: 'Activity', icon: History, group: 'Govern' },
  { to: '/guide', label: 'Guide', icon: HelpCircle, group: 'Help' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'Help' },
];

export const GROUPS: NavItem['group'][] = ['Work', 'Govern', 'Help'];

export const CRUMB_LABELS: Record<string, string> = {
  ask: 'Ask', sources: 'Data Sources', datasets: 'Data Sources', workbench: 'Workbench', builder: 'Query Builder', metrics: 'Metrics', charts: 'Charts',
  dashboards: 'Dashboards', alerts: 'Alerts', reports: 'Reports', quality: 'Quality', activity: 'Activity', settings: 'Settings', guide: 'Guide', new: 'New', studio: 'API Studio',
};

/** Pages that own the whole viewport (their own scroll regions) instead of scrolling as a document. */
export const isFullBleed = (path: string) => path === '/ask' || path === '/sources/studio' || path.startsWith('/workbench') || path === '/builder' || /^\/charts\/[^/]+/.test(path);
