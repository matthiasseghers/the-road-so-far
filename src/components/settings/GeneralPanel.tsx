import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePreferences } from '@/hooks/usePreferences';
import { useThemeContext } from '@/hooks/useThemeContext';
import type { Theme } from '@/types/domain';

export default function GeneralPanel(): JSX.Element {
  const { theme, setTheme } = useThemeContext();
  const { distanceUnit, currency, setDistanceUnit, setCurrency } = usePreferences();

  return (
    <div>
      <h2 className="settings-panel__title">General</h2>

      {/* Theme */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Color mode</h3>
        <div className="theme-options" role="group" aria-label="Color mode">
          {(['light', 'auto', 'dark'] as Theme[]).map(mode => (
            <button
              key={mode}
              className={`theme-card${theme === mode ? ' theme-card--active' : ''}`}
              aria-pressed={theme === mode}
              aria-label={`${mode} color mode`}
              onClick={() => setTheme(mode)}
            >
              {mode === 'auto' ? (
                <div className="theme-card__preview theme-card__preview--auto">
                  <div className="lt theme-card__preview-half" />
                  <div className="dk theme-card__preview-half" />
                </div>
              ) : (
                <div className={`theme-card__preview theme-card__preview--${mode} ${mode === 'light' ? 'lt' : 'dk'}`} />
              )}
              <span className="theme-card__label">
                {mode === 'auto' ? 'Auto' : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Units & currency */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Units &amp; currency</h3>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Distance unit</span>
            <span className="settings-row__hint">Used for route distances on transit reservations</span>
          </div>
          <ToggleGroup
            type="single"
            value={distanceUnit}
            onValueChange={val => { if (val === 'km' || val === 'mi') setDistanceUnit(val); }}
          >
            <ToggleGroupItem value="km" aria-label="Kilometres">km</ToggleGroupItem>
            <ToggleGroupItem value="mi" aria-label="Miles">mi</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="settings-row">
          <div className="settings-row__info">
            <span className="settings-row__label">Currency symbol</span>
            <span className="settings-row__hint">Shown next to costs on reservations</span>
          </div>
          <Input
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            maxLength={4}
            className="w-20 text-center"
            aria-label="Currency symbol"
          />
        </div>
      </div>
    </div>
  );
}
