import { Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { Loading } from '@/components/common/Loading';
import { NotificationBell } from '@/components/NotificationBell';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { isFullBleed } from './nav';
import { savedSidebarWidth } from './SidebarResizeRail';

/** Sidebar + top bar + routed content. Full-bleed pages (Ask, Workbench, Chart studio) fill the viewport below the bar. */
export function AppShell({ children }: { children: ReactNode }) {
  const bleed = isFullBleed(useLocation().pathname);
  const saved = savedSidebarWidth();   // set only when the user dragged the sidebar: an undefined value would wipe the provider's default width
  return (
    <TooltipProvider>
      <SidebarProvider style={saved ? ({ '--sidebar-width': saved } as React.CSSProperties) : undefined}>
        <AppSidebar />
        <SidebarInset className={cn('min-w-0 bg-muted/30', bleed && 'h-svh overflow-hidden')}>
          <header className="sticky top-0 z-20 flex h-10 shrink-0 items-center gap-2 border-b bg-background/80 pl-4 pr-3 backdrop-blur sm:pl-6 sm:pr-4">
            <SidebarTrigger aria-label="Toggle sidebar (Ctrl+B)" className="md:hidden" />
            <Breadcrumbs />
            <div className="ml-auto"><NotificationBell /></div>
          </header>
          <div className={cn(bleed ? 'min-h-0 flex-1 overflow-hidden' : 'p-4 sm:p-6')}>
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>{children}</Suspense>
            </ErrorBoundary>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
