import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { Activity } from '@/domain/Activity';
import type { ActivityRow } from '@/types/db';
import type { CreateActivityInput, UpdateActivityInput } from '@/db/repositories/activities.repo';

interface UseActivitiesReturn {
  activities: Activity[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  createActivity: (input: CreateActivityInput) => Promise<Activity>;
  updateActivity: (id: number, input: UpdateActivityInput) => Promise<Activity>;
  deleteActivity: (id: number) => Promise<void>;
  reorderActivities: (orderedIds: number[]) => Promise<void>;
}

export function useActivities(dayId: number): UseActivitiesReturn {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setLoading(true);
    api.get<ActivityRow[]>(`/activities?dayId=${dayId}`)
      .then(rows => {
        setActivities(rows.map(r => new Activity(r)));
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setLoading(false);
      });
  }, [dayId]);

  useEffect(() => { refetch(); }, [refetch]);

  const createActivity = useCallback(async (input: CreateActivityInput): Promise<Activity> => {
    const row = await api.post<ActivityRow>('/activities', input);
    refetch();
    toast.success('Activity added');
    return new Activity(row);
  }, [refetch]);

  const updateActivity = useCallback(async (id: number, input: UpdateActivityInput): Promise<Activity> => {
    const row = await api.patch<ActivityRow>(`/activities/${id}`, input);
    refetch();
    toast.success('Activity updated');
    return new Activity(row);
  }, [refetch]);

  const deleteActivity = useCallback(async (id: number): Promise<void> => {
    await api.delete(`/activities/${id}`);
    refetch();
    toast.success('Activity deleted');
  }, [refetch]);

  const reorderActivities = useCallback(async (orderedIds: number[]): Promise<void> => {
    await api.put('/activities/reorder', { dayId, orderedIds });
    refetch();
  }, [dayId, refetch]);

  return { activities, loading, error, refetch, createActivity, updateActivity, deleteActivity, reorderActivities };
}

