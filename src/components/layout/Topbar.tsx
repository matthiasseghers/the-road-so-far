import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { Screen } from '@/types/domain';
import './Topbar.css';

const SCREEN_TITLES: Record<Screen, string> = {
  trips:    'My Trips',
  calendar: 'Calendar',
  map:      'Map',
  settings: 'Settings',
  trip:     'Trip',
};

interface TopbarProps {
  activeScreen: Screen;
  onNewTrip?: () => void;
  // Reason: optional slot for breadcrumb/custom left content (used by TripDetailPage).
  // When provided, replaces the default SidebarTrigger + title combination.
  left?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function Topbar({ activeScreen, onNewTrip, left, actions }: TopbarProps): JSX.Element {
  return (
    <header className="topbar">
      <div className="topbar__left">
        {left ?? (
          <>
            <SidebarTrigger />
            <h1 className="topbar__title">{SCREEN_TITLES[activeScreen]}</h1>
          </>
        )}
      </div>

      <div className="topbar__actions">
        {actions}
        {activeScreen === 'trips' && onNewTrip && (
          <Button onClick={onNewTrip} type="button" size="sm">
            <Plus size={16} />
            New trip
          </Button>
        )}
      </div>
    </header>
  );
}
