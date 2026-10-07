import { NavLink, useLocation } from 'react-router-dom';
import { BRAND_NAME } from '@/lib/brand';
import { LogOut, Moon, Sun } from 'lucide-react';
import { LogoIcon } from '@/components/common/LogoIcon';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/features/auth/AuthProvider';
import { useIsDark } from '@/hooks/useIsDark';
import { toggleDarkMode } from '@/lib/theme';
import { GROUPS, NAV } from './nav';
import { SidebarResizeRail } from './SidebarResizeRail';

/** Collapsible-to-icons navigation; becomes an off-canvas drawer on phones. */
export function AppSidebar() {
  const { pathname } = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const dark = useIsDark();
  const auth = useAuth();
  const active = (to: string, end?: boolean) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <Sidebar collapsible="icon" className="z-30">
      <SidebarHeader className="p-1">
        <div className="flex h-8 items-center gap-2 pl-2 pr-5">
          <LogoIcon className="size-7 shrink-0" />
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">{BRAND_NAME}</span>
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
          {auth.enabled && (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={`Sign out ${auth.email ?? ''}`} onClick={auth.signOut}>
                <LogOut />
                <span className="truncate">Sign out{auth.email ? ` (${auth.email})` : ''}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarResizeRail />
    </Sidebar>
  );
}
