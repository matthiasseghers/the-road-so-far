// AppSidebar — shadcn Sidebar wrapper.
// collapsible="icon": desktop collapses to icon rail, mobile becomes Sheet drawer.

import { Navigation, Luggage, Calendar, Map, Settings, Sun, Moon, Monitor, type LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import type { Screen, Theme } from '@/types/domain';

interface AppSidebarProps {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
  theme: Theme;
  onThemeToggle: () => void;
}

interface NavItem {
  screen: Screen;
  icon: LucideIcon;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { screen: 'trips',    icon: Luggage,   label: 'My Trips'  },
  { screen: 'calendar', icon: Calendar,  label: 'Calendar'  },
  { screen: 'map',      icon: Map,       label: 'Map'       },
];

export function AppSidebar({
  activeScreen,
  onNavigate,
  theme,
  onThemeToggle,
}: AppSidebarProps): JSX.Element {
  const ThemeIcon    = theme === 'dark' ? Sun : theme === 'auto' ? Monitor : Moon;
  const themeLabel   = theme === 'dark' ? 'Light mode' : theme === 'auto' ? 'Dark mode' : 'Dark mode';
  const themeTooltip = theme === 'dark' ? 'Switch to light mode' : theme === 'auto' ? 'Switch to dark mode' : 'Switch to dark mode';

  return (
    <Sidebar collapsible="icon">
      {/* ── Brand ──────────────────────────────────────────────────── */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="The Road So Far"
              asChild
            >
              <button type="button" onClick={() => onNavigate('trips')}>
                {/* Reason: size-8 icon container = collapsed button size → overflow-hidden clips
                    the flex-1 text div to zero naturally, no hidden class needed. */}
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0">
                  <Navigation size={16} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  {/* Reason: font-display (Merriweather) applied inline — one-off brand token */}
                  <span
                    className="truncate font-semibold"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.01em' }}
                  >
                    The Road So Far
                  </span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ── Primary nav ────────────────────────────────────────────── */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ screen, icon: Icon, label }) => (
                <SidebarMenuItem key={screen}>
                  <SidebarMenuButton
                    tooltip={label}
                    isActive={activeScreen === screen}
                    onClick={() => onNavigate(screen)}
                    // Reason: shadcn active state doesn't colour the icon; amber icon matches old sidebar design.
                    className={activeScreen === screen ? '[&_svg]:text-sidebar-primary' : ''}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ── Footer: settings + theme toggle ────────────────────────── */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={activeScreen === 'settings'}
              onClick={() => onNavigate('settings')}
              className={activeScreen === 'settings' ? '[&_svg]:text-sidebar-primary' : ''}
            >
              <Settings size={16} />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={themeTooltip} onClick={onThemeToggle}>
              <ThemeIcon size={16} />
              <span>{themeLabel}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* Reason: SidebarRail provides a click-to-collapse drag handle on desktop */}
      <SidebarRail />
    </Sidebar>
  );
}
