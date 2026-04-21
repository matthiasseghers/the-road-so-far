// App.tsx — Root component. Holds theme state, screen router, and app shell.
// Phase 3+: Sidebar + Topbar layout with swappable screen content.
// Phase 4: screen state replaced with a back-stack for trip detail navigation.

import { useState, useEffect } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layout/AppSidebar';
import Topbar from '@/components/layout/Topbar';
import TripsPage from '@/pages/TripsPage';
import TripDetailPage from '@/pages/TripDetailPage';
import CalendarPage from '@/pages/CalendarPage';
import SettingsPage from '@/pages/SettingsPage';
import type { Screen, Theme } from '@/types/domain';
import { Toaster } from '@/components/ui/sonner';

const THEME_STORAGE_KEY = 'rsf-theme';

// ScreenEntry pairs a screen name with optional context data.
// ownsTopbar: true means the page renders its own <Topbar> — App.tsx skips it.
interface ScreenEntry {
  screen: Screen;
  tripId?: number;
  ownsTopbar?: boolean;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  // Reason: suppress all CSS transitions for one paint frame so the class swap
  // is instantaneous — prevents color-interpolation flashes between dark and
  // light token values (e.g. amber midpoints in transition curves).
  root.classList.add('no-transitions');
  root.classList.toggle('dk', resolved === 'dark');
  root.classList.toggle('lt', resolved === 'light');
  requestAnimationFrame(() => root.classList.remove('no-transitions'));
}

export default function App(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [stack, setStack] = useState<ScreenEntry[]>([{ screen: 'trips' }]);
  const [newTripOpen, setNewTripOpen] = useState(false);

  const current = stack[stack.length - 1];

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Reason: when auto, we must re-apply whenever the OS preference changes.
  useEffect(() => {
    if (theme !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (): void => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  function handleThemeToggle(): void {
    // Reason: sidebar quick-toggle switches between explicit light/dark,
    // resolving the current effective colour when in auto mode.
    const resolved = resolveTheme(theme);
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }

  function handleNavigate(screen: Screen, tripId?: number): void {
    // Reason: 'trip' renders its own Topbar (breadcrumb nav); flag it so App.tsx skips rendering one.
    const ownsTopbar = screen === 'trip';
    setStack(prev => [...prev, { screen, tripId, ownsTopbar }]);
  }

  function handleGoBack(): void {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  function renderScreen(): JSX.Element {
    switch (current.screen) {
      case 'trips':
        return (
          <TripsPage
            onNavigate={handleNavigate}
            newTripOpen={newTripOpen}
            onNewTripOpenChange={setNewTripOpen}
          />
        );
      case 'calendar':
        return <CalendarPage />;
      case 'map':
        return <Placeholder title="Map" subtitle="Phase 5" />;
      case 'settings':
        return (
          <SettingsPage
            theme={theme}
            onThemeChange={setTheme}
            onDataWiped={() => setStack([{ screen: 'trips' }])}
          />
        );
      case 'trip':
        return (
          <TripDetailPage
            tripId={current.tripId!}
            onBack={handleGoBack}
            onDelete={handleGoBack}
          />
        );
    }
  }

  return (
    <TooltipProvider>
    {/* Reason: --sidebar-width overrides sidebar.tsx default (16rem) to match our 240px design token. */}
    <SidebarProvider
      style={{ '--sidebar-width': '240px' } as React.CSSProperties}
      className="h-full overflow-hidden"
    >
      <AppSidebar
        activeScreen={current.screen}
        onNavigate={screen => setStack([{ screen }])}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

      <SidebarInset className="overflow-hidden">
        {/* Reason: pages that own their Topbar set ownsTopbar:true on the ScreenEntry.
            Any new page that needs custom nav just sets it when pushing to the stack. */}
        {!current.ownsTopbar && (
          <Topbar
            activeScreen={current.screen}
            onNewTrip={current.screen === 'trips' ? () => setNewTripOpen(true) : undefined}
          />
        )}
        <div className="app-shell__content">
          {renderScreen()}
        </div>
      </SidebarInset>

      <Toaster />
    </SidebarProvider>
    </TooltipProvider>
  );
}

function Placeholder({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <div className="app-placeholder">
      <h2 className="app-placeholder__title">{title}</h2>
      <p className="app-placeholder__sub">{subtitle}</p>
    </div>
  );
}

