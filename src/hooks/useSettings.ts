import { useState, useCallback, useEffect } from 'react';
import { api } from '@/db/api-client';
import type { AppSettings } from '@/types/domain';

interface UseSettingsReturn {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  setSetting: <T>(key: string, value: T) => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    api.get<AppSettings>('/settings')
      .then(data => { setSettings(data); setError(null); setLoading(false); })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const setSetting = useCallback(async <T>(key: string, value: T): Promise<void> => {
    await api.put(`/settings/${key}`, { value });
    refetch();
  }, [refetch]);

  return { settings, loading, error, setSetting };
}
