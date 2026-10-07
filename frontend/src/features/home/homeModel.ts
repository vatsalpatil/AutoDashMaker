import {
  BarChart3, Blocks, Database, LayoutDashboard, Sparkles, TerminalSquare, type LucideIcon,
} from 'lucide-react';

export interface QuickAction { to: string; title: string; text: string; icon: LucideIcon }

/** The jump-off cards on Home, ordered by how often people start there. */
export const QUICK_ACTIONS: QuickAction[] = [
  { to: '/ask', title: 'Ask a question', text: 'Plain English in, answer + chart out.', icon: Sparkles },
  { to: '/builder', title: 'Build a query', text: 'Pick a table and add steps. No SQL needed.', icon: Blocks },
  { to: '/workbench', title: 'Write SQL', text: 'A notebook with an AI assistant.', icon: TerminalSquare },
  { to: '/sources', title: 'Connect data', text: 'Upload a file or link a database.', icon: Database },
  { to: '/charts/new', title: 'Create a chart', text: '12+ chart types with live preview.', icon: BarChart3 },
  { to: '/dashboards', title: 'Build a dashboard', text: 'Generate one from your data in a click.', icon: LayoutDashboard },
];

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** "vatsal.patil@x.com" -> "Vatsal". Null when there is no usable name. */
export function firstName(email: string | null | undefined): string | null {
  const first = (email ?? '').split('@')[0].split(/[._\-+0-9]/)[0];
  return first ? first[0].toUpperCase() + first.slice(1).toLowerCase() : null;
}
