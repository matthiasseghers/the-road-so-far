import { useState } from 'react';
import { Settings2, ListChecks, Database, Plug, Tag } from 'lucide-react';
import GeneralPanel from '@/components/settings/GeneralPanel';
import ServicesPanel from '@/components/settings/ServicesPanel';
import TemplatesPanel from '@/components/settings/TemplatesPanel';
import DataPanel from '@/components/settings/DataPanel';
import ActivityTypesPanel from '@/components/settings/ActivityTypesPanel';
import type { LucideIcon } from 'lucide-react';
import './SettingsPage.css';

type Section = 'general' | 'services' | 'templates' | 'activity-types' | 'data';

const SECTIONS: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'general',        label: 'General',        icon: Settings2  },
  { id: 'services',       label: 'Services',       icon: Plug       },
  { id: 'templates',      label: 'Templates',      icon: ListChecks },
  { id: 'activity-types', label: 'Activity Types', icon: Tag        },
  { id: 'data',           label: 'Data',           icon: Database   },
];

interface SettingsPageProps {
  onDataWiped: () => void;
}

export default function SettingsPage({ onDataWiped }: SettingsPageProps): JSX.Element {
  const [activeSection, setActiveSection] = useState<Section>('general');

  return (
    <div className="settings-page-wrap">
    <div className="settings-page">
      {/* Left nav */}
      <nav className="settings-nav" aria-label="Settings navigation">
        <ul className="settings-nav__list">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                className={`settings-nav__btn${activeSection === id ? ' settings-nav__btn--active' : ''}`}
                onClick={() => setActiveSection(id)}
              >
                <Icon size={14} />
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Right content */}
      <div className="settings-content">
        {activeSection === 'general'        && <GeneralPanel />}
        {activeSection === 'services'       && <ServicesPanel />}
        {activeSection === 'templates'      && <TemplatesPanel />}
        {activeSection === 'activity-types' && <ActivityTypesPanel />}
        {activeSection === 'data'           && <DataPanel      onDataWiped={onDataWiped} />}
      </div>
    </div>
    </div>
  );
}
