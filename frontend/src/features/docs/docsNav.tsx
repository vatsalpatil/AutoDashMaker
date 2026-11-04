import type { ReactNode } from 'react';
import { AiAssistantSection } from '@/features/guide/sections/AiAssistantSection';
import { ConceptsSection } from '@/features/guide/sections/ConceptsSection';
import { FlowsSection } from '@/features/guide/sections/FlowsSection';
import { TipsSection } from '@/features/guide/sections/TipsSection';
import { WalkthroughsSection } from '@/features/guide/sections/WalkthroughsSection';
import { UseCasesSection } from './DocsSections';
import { PageTitle } from './DocsKit';
import { AskPage, BuilderPage, ChartsPage, WorkbenchPage } from './pages/AnalyzePages';
import { DatasetsPage, SourcesPage, TransformsPage } from './pages/DataPages';
import { ArchitecturePage, ConfigPage, FeaturesPage, TroubleshootingPage } from './pages/ReferencePages';
import { AlertsPage, DashboardsPage, McpPage, SecurityPage } from './pages/ShipPages';
import { InstallPage, OverviewPage, QuickstartPage } from './pages/StartPages';

export type Go = (id: string) => void;
export interface DocPage { id: string; tab: string; group: string; title: string; keywords?: string; render: (go: Go) => ReactNode }

/** Wraps an older guide section with a proper page title. */
const legacy = (title: string, lead: string, body: ReactNode) => (
  <><PageTitle eyebrow="Guides" title={title} lead={lead} />{body}</>
);

/** Every docs page, in reading order. Tab → group → page, like a docs site sidebar. */
export const PAGES: DocPage[] = [
  { id: 'overview', tab: 'Get started', group: 'Introduction', title: 'Overview', render: (go) => <OverviewPage go={go} /> },
  { id: 'quickstart', tab: 'Get started', group: 'Introduction', title: 'Quickstart', keywords: 'first dashboard csv', render: (go) => <QuickstartPage go={go} /> },
  { id: 'install', tab: 'Get started', group: 'Introduction', title: 'Install & run locally', keywords: 'docker setup self-host', render: () => <InstallPage /> },
  { id: 'concepts', tab: 'Get started', group: 'Core concepts', title: 'Concepts', render: () => legacy('Concepts', 'The vocabulary used across the app.', <ConceptsSection />) },
  { id: 'flows', tab: 'Get started', group: 'Core concepts', title: 'How data flows', render: () => legacy('How data flows', 'Diagrams of the main paths through the product.', <FlowsSection />) },

  { id: 'sources', tab: 'Guides', group: 'Data', title: 'Connect data sources', keywords: 'postgres mysql csv excel rest graphql sheets', render: () => <SourcesPage /> },
  { id: 'datasets', tab: 'Guides', group: 'Data', title: 'Datasets, quality & versions', keywords: 'profile score tests refresh rollback', render: () => <DatasetsPage /> },
  { id: 'transforms', tab: 'Guides', group: 'Data', title: 'Transforms, metrics & Why', keywords: 'polars python semantic lineage', render: () => <TransformsPage /> },
  { id: 'workbench', tab: 'Guides', group: 'Analyze', title: 'SQL Workbench', keywords: 'notebook duckdb parameters', render: () => <WorkbenchPage /> },
  { id: 'builder', tab: 'Guides', group: 'Analyze', title: 'Visual Query Builder', keywords: 'no code join filter', render: () => <BuilderPage /> },
  { id: 'charts', tab: 'Guides', group: 'Visualize', title: 'Charts', keywords: 'bar line kpi pie encoding', render: () => <ChartsPage /> },
  { id: 'dashboards', tab: 'Guides', group: 'Visualize', title: 'Dashboards', keywords: 'grid filters pages generate', render: () => <DashboardsPage /> },
  { id: 'alerts', tab: 'Guides', group: 'Operate', title: 'Alerts & reports', keywords: 'webhook schedule threshold', render: () => <AlertsPage /> },
  { id: 'security', tab: 'Guides', group: 'Operate', title: 'Security & sharing', keywords: 'privacy share link encryption', render: () => <SecurityPage /> },
  { id: 'use-cases', tab: 'Guides', group: 'Tutorials', title: 'Use cases', render: () => legacy('Use cases', 'End-to-end examples with screen recordings.', <UseCasesSection />) },
  { id: 'walkthroughs', tab: 'Guides', group: 'Tutorials', title: 'Walkthroughs', render: () => legacy('Walkthroughs', 'Click-by-click tours of common tasks.', <WalkthroughsSection />) },
  { id: 'tips', tab: 'Guides', group: 'Tutorials', title: 'Tips & shortcuts', render: () => legacy('Tips & shortcuts', 'Small things that save time.', <TipsSection />) },

  { id: 'ask', tab: 'AI', group: 'AI in Dashtor', title: 'Ask in plain English', keywords: 'nl2sql question', render: () => <AskPage /> },
  { id: 'assistant', tab: 'AI', group: 'AI in Dashtor', title: 'AI Assistant', keywords: 'agent chat', render: () => legacy('AI Assistant', 'Chat with an agent that can query and build for you.', <AiAssistantSection />) },
  { id: 'mcp', tab: 'AI', group: 'Bring your own AI', title: 'Connect your AI (MCP)', keywords: 'claude chatgpt cursor token', render: () => <McpPage /> },

  { id: 'config', tab: 'Reference', group: 'Reference', title: 'Configuration', keywords: 'env variables settings', render: () => <ConfigPage /> },
  { id: 'architecture', tab: 'Reference', group: 'Reference', title: 'Architecture', render: () => <ArchitecturePage /> },
  { id: 'features', tab: 'Reference', group: 'Reference', title: 'Every feature', render: () => <FeaturesPage /> },
  { id: 'troubleshooting', tab: 'Reference', group: 'Help', title: 'Troubleshooting & FAQ', keywords: 'error timeout', render: () => <TroubleshootingPage /> },
];

export const TABS = [...new Set(PAGES.map((p) => p.tab))];
