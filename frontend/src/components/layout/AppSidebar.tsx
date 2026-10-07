import { NavLink, useLocation } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { LogoIcon } from '@/components/common/LogoIcon';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { useIsDark } from '@/hooks/useIsDark';
import { toggleDarkMode } from '@/lib/theme';
import { GROUPS, NAV } from './nav';
import { SidebarResizeRail } from './SidebarResizeRail';

/** Collapsible-to-icons navigation; becomes an off-canvas drawer on phones. */
export function AppSidebar() {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const dark = useIsDark();
  const active = (to: string, end?: boolean) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <Sidebar collapsible="icon" className="z-30">
      <SidebarHeader className="p-1">
        <div className="flex h-8 items-center gap-2 pl-2 pr-5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><LogoIcon className="size-4" /></span>
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">AutoDashMaker</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {GROUPS.map((g) => (
          <SidebarGroup key={g}>
            <SidebarGroupLabel>{g}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((n) => n.group === g).map(({ to, label, icon: Icon, end }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton tooltip={label} isActive={active(to, end)}
                      render={<NavLink to={to} end={end} onClick={() => isMobile && setOpenMobile(false)} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={dark ? 'Light mode' : 'Dark mode'} onClick={toggleDarkMode}>
              {dark ? <Sun /> : <Moon />}
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarResizeRail />
    </Sidebar>
  );
}
