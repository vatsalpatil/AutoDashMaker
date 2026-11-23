import {
  BarChart3, BookOpen, Brain, Bell, Database, HelpCircle, FileClock, History, Home, LayoutDashboard, Settings, ShieldCheck, Sparkles, TerminalSquare, Blocks,
  type LucideIcon,
} from 'lucide-react';

export type NavGroup = 'Start' | 'Connect' | 'Explore' | 'Define & visualize' | 'Monitor' | 'Help';
/** `hint` is the one-line "what is this for" shown as the sidebar tooltip. */
export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; group: NavGroup; hint: string }

/** Ordered by the user workflow: Connect -> Explore -> Define -> Visualize -> Monitor. */
export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true, group: 'Start', hint: 'Overview, recent work and next steps' },
  { to: '/ask', label: 'Ask', icon: Sparkles, group: 'Start', hint: 'Ask a question in plain English' },
  { to: '/sources', label: 'Data Sources', icon: Database, group: 'Connect', hint: 'Upload files or connect databases and APIs' },
  { to: '/quality', label: 'Quality', icon: ShieldCheck, group: 'Connect', hint: 'Check data for nulls, duplicates and drift' },
  { to: '/workbench', label: 'Workbench', icon: TerminalSquare, group: 'Explore', hint: 'Write SQL in notebook cells' },
  { to: '/builder', label: 'Query Builder', icon: Blocks, group: 'Explore', hint: 'Build a query without code' },
  { to: '/metrics', label: 'Key Numbers', icon: BookOpen, group: 'Define & visualize', hint: 'Define trusted metrics once, reuse everywhere' },
  { to: '/charts', label: 'Charts', icon: BarChart3, group: 'Define & visualize', hint: 'Turn queries into charts' },
  { to: '/dashboards', label: 'Dashboards', icon: LayoutDashboard, group: 'Define & visualize', hint: 'Arrange charts and numbers to share' },
  { to: '/alerts', label: 'Alerts', icon: Bell, group: 'Monitor', hint: 'Get notified when a number crosses a line' },
  { to: '/reports', label: 'Reports', icon: FileClock, group: 'Monitor', hint: 'Run a query on a schedule and deliver results' },
  { to: '/activity', label: 'Activity', icon: History, group: 'Monitor', hint: 'Who ran, changed or shared what' },
  { to: '/guide', label: 'Guide', icon: HelpCircle, group: 'Help', hint: 'How the whole workflow fits together' },
  { to: '/memory', label: 'AI Memory', icon: Brain, group: 'Help', hint: 'What the AI remembers about you: editable Markdown files' },
  { to: '/settings', label: 'Settings', icon: Settings, group: 'Help', hint: 'AI providers, appearance and account' },
];

export const GROUPS: NavGroup[] = ['Start', 'Connect', 'Explore', 'Define & visualize', 'Monitor', 'Help'];

export const CRUMB_LABELS: Record<string, string> = {
  ask: 'Ask', sources: 'Data Sources', datasets: 'Data Sources', workbench: 'Workbench', builder: 'Query Builder', metrics: 'Key Numbers', charts: 'Charts',
  dashboards: 'Dashboards', alerts: 'Alerts', reports: 'Reports', quality: 'Quality', activity: 'Activity', settings: 'Settings', memory: 'AI Memory', guide: 'Guide', new: 'New', generate: 'Generate with AI', studio: 'API Studio',
};

/** Pages that own the whole viewport (their own scroll regions) instead of scrolling as a document. */
export const isFullBleed = (path: string) => path === '/ask' || path === '/sources/studio' || path.startsWith('/workbench') || path === '/builder' || path === '/dashboards/generate' || /^\/charts\/[^/]+/.test(path);
