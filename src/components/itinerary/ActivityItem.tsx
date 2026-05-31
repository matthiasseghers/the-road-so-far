import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/domain';
import { formatActivityTime } from '@/utils/format';
import { resolveIcon } from '@/lib/activityTypeIcons';
import './ActivityItem.css';

interface ActivityItemProps {
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onDelete: (id: number) => void;
}

export default function ActivityItem({ activity, onEdit, onDelete }: ActivityItemProps): JSX.Element {
  const timeLabel = formatActivityTime(activity.start_time, activity.end_time) || null;

  return (
    <div className={`activity-item activity-item--${activity.activity_type}`}>
      <span className="activity-item__icon" aria-hidden="true">{React.createElement(resolveIcon(activity.activity_type_icon), { size: 15 })}</span>

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
