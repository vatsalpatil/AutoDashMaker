import { BarChart3, Blocks, Database, LayoutDashboard, Sparkles, TerminalSquare, type LucideIcon } from 'lucide-react';

export interface QuickAction { to: string; title: string; text: string; icon: LucideIcon }

/** Shortcuts shown on Home, in the order people reach for them. */
export const QUICK_ACTIONS: QuickAction[] = [
  { to: '/ask', title: 'Ask', text: 'Plain English in, answer + chart out', icon: Sparkles },
  { to: '/builder', title: 'Query builder', text: 'Pick a table and add steps, no SQL', icon: Blocks },
  { to: '/workbench', title: 'SQL notebook', text: 'A notebook with an AI assistant', icon: TerminalSquare },
  { to: '/sources', title: 'Add data', text: 'Upload a file or link a database', icon: Database },
  { to: '/charts/new', title: 'New chart', text: '12+ chart types with live preview', icon: BarChart3 },
  { to: '/dashboards', title: 'Dashboard', text: 'Generate one from your data', icon: LayoutDashboard },
];
