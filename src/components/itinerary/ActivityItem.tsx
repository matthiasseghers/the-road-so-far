import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/domain';
import './ActivityItem.css';

// Icon map for activity types
const ACTIVITY_TYPE_ICONS: Record<string, string> = {
  food:        '🍽️',
  attraction:  '🎯',
  shopping:    '🛍️',
  outdoors:    '🌿',
  cultural:    '🏛️',
  note:        '📝',
  other:       '📌',
};

interface ActivityItemProps {
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onDelete: (id: number) => void;
}

export default function ActivityItem({ activity, onEdit, onDelete }: ActivityItemProps): JSX.Element {
  const icon = ACTIVITY_TYPE_ICONS[activity.activity_type] ?? '📌';
  const timeLabel = activity.timeDisplay() || null;

  return (
    <div className={`activity-item activity-item--${activity.activity_type}`}>
      <span className="activity-item__icon" aria-hidden="true">{icon}</span>

      <div className="activity-item__body">
        <span className="activity-item__title">{activity.title}</span>

        {(timeLabel) && (
          <span className="activity-item__meta">
            {timeLabel && <span className="activity-item__time">{timeLabel}</span>}
          </span>
        )}

        {activity.notes && (
          <span className="activity-item__notes">{activity.notes}</span>
        )}
      </div>

      <div className="activity-item__actions">
        <Button variant="ghost" size="icon-xs"
          onClick={() => onEdit(activity)}
          type="button"
          aria-label={`Edit ${activity.title}`}
        >
          <Pencil size={13} />
        </Button>
        <Button variant="ghost" size="icon-xs" className="hover:text-destructive hover:bg-destructive/10"
          onClick={() => onDelete(activity.id)}
          type="button"
          aria-label={`Delete ${activity.title}`}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}
