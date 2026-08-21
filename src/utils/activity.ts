import type { Activity } from '@/types/domain';

// ─── Activity sorting ─────────────────────────────────────────────────────────

/**
 * Sorts Activity domain instances: timed activities first (by start_time),
 * then untimed activities (by sort_order).
 * Returns a new array — does not mutate the input.
 */
export function sortActivities(activities: Activity[]): Activity[] {
  return [...activities].sort((a, b) => {
    if (a.start_time && !b.start_time) return -1;
    if (!a.start_time && b.start_time) return 1;
    if (a.start_time && b.start_time) {
      const cmp = a.start_time.localeCompare(b.start_time);
      if (cmp !== 0) return cmp;
    }
    return a.sort_order - b.sort_order;
  });
}
