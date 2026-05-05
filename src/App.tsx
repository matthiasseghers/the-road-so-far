// App.tsx — Root component. Holds screen router and app shell.
// Phase 3+: Sidebar + Topbar layout with swappable screen content.
// Phase 4: screen state replaced with a back-stack for trip detail navigation.

import { useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from '@/components/layout/AppSidebar';
import Topbar from '@/components/layout/Topbar';
import TripsPage from '@/pages/TripsPage';
import TripDetailPage from '@/pages/TripDetailPage';
import CalendarPage from '@/pages/CalendarPage';
import MapPage from '@/pages/MapPage';
import SettingsPage from '@/pages/SettingsPage';
import type { Screen } from '@/types/domain';
import { Toaster } from '@/components/ui/sonner';
import { useThemeContext } from '@/context/ThemeContext';

// Reason: screens that render their own <Topbar> declare it here so App.tsx
// never needs an if/else per screen — add a new screen, set the flag once.
const SCREEN_OWNS_TOPBAR: Partial<Record<Screen, true>> = {
  trip: true,
};

// ScreenEntry pairs a screen name with optional context data.
interface ScreenEntry {
  screen: Screen;
  tripId?: number;
}

export default function App(): JSX.Element {
  const { theme, toggleTheme } = useThemeContext();
  const [stack, setStack] = useState<ScreenEntry[]>([{ screen: 'trips' }]);
  const [newTripOpen, setNewTripOpen] = useState(false);

  const current = stack[stack.length - 1];

  function handleNavigate(screen: Screen, tripId?: number): void {
    setStack(prev => [...prev, { screen, tripId }]);
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
        return <MapPage />;
      case 'settings':
        return (
          <SettingsPage
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
        onThemeToggle={toggleTheme}
      />

      <SidebarInset className="overflow-hidden">
        {/* Reason: screens listed in SCREEN_OWNS_TOPBAR render their own header. */}
        {!SCREEN_OWNS_TOPBAR[current.screen] && (
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
