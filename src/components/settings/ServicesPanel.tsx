import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import type { GeocodingProviderName, RoutingProviderName, MapsProviderName } from '@/types/domain';

interface ProviderSettings {
  geocoding_provider: GeocodingProviderName;
  routing_provider:   RoutingProviderName;
  maps_provider:      MapsProviderName;
}

// ── Provider option lists ─────────────────────────────────────────────────────
// Reason: arrays make it easy to add a new provider in one place — the UI
// renders from these without any additional JSX changes.

const GEOCODING_OPTIONS: { value: GeocodingProviderName; label: string; needsKey: boolean }[] = [
  { value: 'nominatim', label: 'Nominatim (OpenStreetMap) — free, no key required', needsKey: false },
  { value: 'tomtom',    label: 'TomTom Fuzzy Search — uses TomTom key',              needsKey: true  },
];

const ROUTING_OPTIONS: { value: RoutingProviderName; label: string; needsKey: boolean }[] = [
  { value: 'tomtom', label: 'TomTom Routing — uses TomTom key', needsKey: true },
];

const MAPS_OPTIONS: { value: MapsProviderName; label: string; needsKey: boolean }[] = [
  { value: 'tomtom', label: 'TomTom Static Images — uses TomTom key', needsKey: true },
];

export default function ServicesPanel(): JSX.Element {
  const [apiKey, setApiKey]       = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [providers, setProviders] = useState<ProviderSettings>({
    geocoding_provider: 'nominatim',
    routing_provider:   'tomtom',
    maps_provider:      'tomtom',
  });

  // Image provider keys
  const [pexelsKey,       setPexelsKey]       = useState('');
  const [pexelsSaved,     setPexelsSaved]     = useState(false);
  const [unsplashKey,     setUnsplashKey]     = useState('');
  const [unsplashSaved,   setUnsplashSaved]   = useState(false);
  const [unsplashApp,     setUnsplashApp]     = useState('');
  const [unsplashAppSaved,setUnsplashAppSaved]= useState(false);
  const [pixabayKey,      setPixabayKey]      = useState('');
  const [pixabaySaved,    setPixabaySaved]    = useState(false);

  useEffect(() => {
    api.get<{ tomtom_api_key: string }>('/settings/tomtom_api_key')
      .then(({ tomtom_api_key }) => { if (tomtom_api_key) setApiKey(tomtom_api_key); })
      .catch(() => { /* ignore */ });

    api.get<ProviderSettings>('/settings')
      .then(s => setProviders({
        geocoding_provider: s.geocoding_provider ?? 'nominatim',
        routing_provider:   s.routing_provider   ?? 'tomtom',
        maps_provider:      s.maps_provider       ?? 'tomtom',
      }))
      .catch(() => { /* ignore */ });

    // Load image provider keys.
    api.get<{ pexels_api_key: string }>('/settings/pexels_api_key')
      .then(r => { if (r.pexels_api_key) setPexelsKey(r.pexels_api_key); }).catch(() => {});
    api.get<{ unsplash_api_key: string }>('/settings/unsplash_api_key')
      .then(r => { if (r.unsplash_api_key) setUnsplashKey(r.unsplash_api_key); }).catch(() => {});
    api.get<{ unsplash_app_name: string }>('/settings/unsplash_app_name')
      .then(r => { if (r.unsplash_app_name) setUnsplashApp(r.unsplash_app_name); }).catch(() => {});
    api.get<{ pixabay_api_key: string }>('/settings/pixabay_api_key')
      .then(r => { if (r.pixabay_api_key) setPixabayKey(r.pixabay_api_key); }).catch(() => {});
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

  async function saveImageKey(settingKey: string, value: string, onSaved: () => void): Promise<void> {
    try {
      await api.put(`/settings/${settingKey}`, { value: value.trim() });
      onSaved();
      toast.success('API key saved');
    } catch {
      toast.error('Failed to save API key');
    }
  }

  async function saveProvider<K extends keyof ProviderSettings>(
    key: K,
    value: ProviderSettings[K],
  ): Promise<void> {
    setProviders(prev => ({ ...prev, [key]: value }));
    try {
      await api.put(`/settings/${key}`, { value });
      toast.success('Provider updated');
    } catch {
      toast.error('Failed to save provider');
    }
  }

  // Reason: show the TomTom key section if any active provider requires it.
  const anyProviderNeedsKey =
    GEOCODING_OPTIONS.find(o => o.value === providers.geocoding_provider)?.needsKey ||
    ROUTING_OPTIONS.find(o => o.value === providers.routing_provider)?.needsKey ||
    MAPS_OPTIONS.find(o => o.value === providers.maps_provider)?.needsKey;

  return (
    <div>
      <h2 className="settings-panel__title">Services</h2>

      {/* Geocoding */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Geocoding</h3>
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">Provider</span>
            <span className="settings-row__hint">
              Converts location names to coordinates on activities and reservations. Also
              powers the autocomplete dropdown in location fields.
            </span>
          </div>
          <Select
            value={providers.geocoding_provider}
            onValueChange={val => void saveProvider('geocoding_provider', val as GeocodingProviderName)}
          >
            <SelectTrigger className="w-auto min-w-48" aria-label="Geocoding provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GEOCODING_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Routing */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Routing</h3>
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">Provider</span>
            <span className="settings-row__hint">
              Calculates turn-by-turn routes between consecutive days. Results are cached
              in the local database — syncing the same trip again reuses cached legs.
            </span>
          </div>
          <Select
            value={providers.routing_provider}
            onValueChange={val => void saveProvider('routing_provider', val as RoutingProviderName)}
          >
            <SelectTrigger className="w-auto min-w-48" aria-label="Routing provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUTING_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Maps */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Maps</h3>
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">Static image provider</span>
            <span className="settings-row__hint">
              Fetches raster map images embedded in PDF exports. The interactive Leaflet
              map always uses OpenStreetMap tiles regardless of this setting.
            </span>
          </div>
          <Select
            value={providers.maps_provider}
            onValueChange={val => void saveProvider('maps_provider', val as MapsProviderName)}
          >
            <SelectTrigger className="w-auto min-w-48" aria-label="Maps provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAPS_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* API keys — only shown when at least one active provider requires a key */}
      {anyProviderNeedsKey && (
        <div className="settings-section">
          <h3 className="settings-subsection__title">API keys</h3>
          <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="settings-row__info">
              <span className="settings-row__label">TomTom API key</span>
              <span className="settings-row__hint">
                Required by TomTom routing, static map images, and Fuzzy Search geocoding.
                Get a free key at{' '}
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
        </div>
      )}

      {/* Cover photos — image provider API keys */}
      <div className="settings-section">
        <h3 className="settings-subsection__title">Cover photos</h3>
        <p className="settings-row__hint" style={{ marginBottom: 'var(--space-3)' }}>
          Add an API key for at least one provider to enable photo search when picking a
          trip cover. Keys are stored locally and never leave your device.
        </p>

        {/* Pexels */}
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">Pexels API key</span>
            <span className="settings-row__hint">
              Free, unlimited. Get a key at{' '}
              <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer" className="underline">pexels.com/api</a>.
            </span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Input
              type="password"
              value={pexelsKey}
              onChange={e => setPexelsKey(e.target.value)}
              placeholder="Enter your Pexels API key…"
              className="flex-1 font-mono text-xs"
              aria-label="Pexels API key"
              onKeyDown={e => { if (e.key === 'Enter') void saveImageKey('pexels_api_key', pexelsKey, () => { setPexelsSaved(true); setTimeout(() => setPexelsSaved(false), 2000); }); }}
            />
            <Button variant="outline" size="sm" disabled={pexelsSaved}
              onClick={() => void saveImageKey('pexels_api_key', pexelsKey, () => { setPexelsSaved(true); setTimeout(() => setPexelsSaved(false), 2000); })}>
              {pexelsSaved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Unsplash */}
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">Unsplash Access Key</span>
            <span className="settings-row__hint">
              Free. Register at{' '}
              <a href="https://unsplash.com/developers" target="_blank" rel="noreferrer" className="underline">unsplash.com/developers</a>.
            </span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Input
              type="password"
              value={unsplashKey}
              onChange={e => setUnsplashKey(e.target.value)}
              placeholder="Enter your Unsplash Access Key…"
              className="flex-1 font-mono text-xs"
              aria-label="Unsplash Access Key"
              onKeyDown={e => { if (e.key === 'Enter') void saveImageKey('unsplash_api_key', unsplashKey, () => { setUnsplashSaved(true); setTimeout(() => setUnsplashSaved(false), 2000); }); }}
            />
            <Button variant="outline" size="sm" disabled={unsplashSaved}
              onClick={() => void saveImageKey('unsplash_api_key', unsplashKey, () => { setUnsplashSaved(true); setTimeout(() => setUnsplashSaved(false), 2000); })}>
              {unsplashSaved ? 'Saved!' : 'Save'}
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full" style={{ marginTop: 'var(--space-1)' }}>
            <Input
              type="text"
              value={unsplashApp}
              onChange={e => setUnsplashApp(e.target.value)}
              placeholder="App name (shown to Unsplash, e.g. The Road So Far)…"
              className="flex-1 text-xs"
              aria-label="Unsplash app name"
              onKeyDown={e => { if (e.key === 'Enter') void saveImageKey('unsplash_app_name', unsplashApp, () => { setUnsplashAppSaved(true); setTimeout(() => setUnsplashAppSaved(false), 2000); }); }}
            />
            <Button variant="outline" size="sm" disabled={unsplashAppSaved}
              onClick={() => void saveImageKey('unsplash_app_name', unsplashApp, () => { setUnsplashAppSaved(true); setTimeout(() => setUnsplashAppSaved(false), 2000); })}>
              {unsplashAppSaved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Pixabay */}
        <div className="settings-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className="settings-row__info">
            <span className="settings-row__label">Pixabay API key</span>
            <span className="settings-row__hint">
              Free. Get a key at{' '}
              <a href="https://pixabay.com/api/docs/" target="_blank" rel="noreferrer" className="underline">pixabay.com/api/docs</a>.
            </span>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Input
              type="password"
              value={pixabayKey}
              onChange={e => setPixabayKey(e.target.value)}
              placeholder="Enter your Pixabay API key…"
              className="flex-1 font-mono text-xs"
              aria-label="Pixabay API key"
              onKeyDown={e => { if (e.key === 'Enter') void saveImageKey('pixabay_api_key', pixabayKey, () => { setPixabaySaved(true); setTimeout(() => setPixabaySaved(false), 2000); }); }}
            />
            <Button variant="outline" size="sm" disabled={pixabaySaved}
              onClick={() => void saveImageKey('pixabay_api_key', pixabayKey, () => { setPixabaySaved(true); setTimeout(() => setPixabaySaved(false), 2000); })}>
              {pixabaySaved ? 'Saved!' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}