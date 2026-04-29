import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePreferences } from '@/hooks/usePreferences';
import { api } from '@/db/api-client';
import type { Theme } from '@/types/domain';

interface UsageStats {
  today: number;
  total: number;
  dailyLimit: number;
}

interface GeneralPanelProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export default function GeneralPanel({ theme, onThemeChange }: GeneralPanelProps): JSX.Element {
  const { distanceUnit, currency, setDistanceUnit, setCurrency } = usePreferences();
  const [apiKey, setApiKey]       = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [usage, setUsage]         = useState<UsageStats | null>(null);

  useEffect(() => {
    // Reason: load the API key from the dedicated endpoint so the general
    // GET /settings response doesn’t expose the raw key to the rest of the app.
    api.get<{ tomtom_api_key: string }>('/settings/tomtom_api_key')
      .then(({ tomtom_api_key }) => { if (tomtom_api_key) setApiKey(tomtom_api_key); })
      .catch(() => { /* ignore */ });

    api.get<UsageStats>('/route-legs/usage')
      .then(setUsage)
      .catch(() => { /* ignore — table may not exist yet */ });
  }, []);

  async function saveApiKey(): Promise<void> {
    try {
      await api.put('/settings/tomtom_api_key', { value: apiKey.trim() });
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
      toast.success('API key saved');
    } catch {
      toast.error('Failed to save API key');
    }
  }

  const usedPct = usage ? Math.round((usage.today / usage.dailyLimit) * 100) : 0;
  // Reason: warn when within 20% of the daily cap so the user can stop syncing.
  const usageColour = usedPct >= 80 ? 'text-destructive' : usedPct >= 50 ? 'text-amber-500' : 'text-muted-foreground';

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
              onClick={() => onThemeChange(mode)}
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

      {/* TomTom routing */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Routing</h3>

        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">TomTom API key</span>
            <span className="settings-row__hint">
              Used to calculate driving routes between days. Get a free key at{' '}
              <a href="https://developer.tomtom.com" target="_blank" rel="noreferrer" className="underline">
                developer.tomtom.com
              </a>
              . Never sent anywhere except TomTom.
            </span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your TomTom API key…"
              className="flex-1 font-mono text-xs"
              aria-label="TomTom API key"
              onKeyDown={e => { if (e.key === 'Enter') void saveApiKey(); }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void saveApiKey()}
              disabled={apiKeySaved}
            >
              {apiKeySaved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>

        {usage !== null && (
          <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <div className="settings-row__info">
              <span className="settings-row__label">API usage (today)</span>
              <span className="settings-row__hint">
                Each "Sync routes" click fetches one leg per consecutive day pair. Legs are cached — re-syncing the same trip doesn't re-fetch already-cached routes.
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full">
              <div
                className="h-1.5 w-full rounded-full bg-border overflow-hidden"
                role="progressbar"
                aria-valuenow={usage.today}
                aria-valuemax={usage.dailyLimit}
                aria-label="Daily TomTom API usage"
              >
                <div
                  className={`h-full rounded-full transition-all ${usedPct >= 80 ? 'bg-destructive' : usedPct >= 50 ? 'bg-amber-500' : 'bg-primary'}`}
                  style={{ width: `${Math.min(usedPct, 100)}%` }}
                />
              </div>
              <p className={`mt-1 text-xs ${usageColour}`}>
                {usage.today.toLocaleString()} / {usage.dailyLimit.toLocaleString()} calls today
                {' · '}{usage.total.toLocaleString()} cached legs total
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
