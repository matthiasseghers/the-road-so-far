import { Pencil, Trash2, Utensils, Camera, ShoppingBag, TreePine, Landmark, FileText, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Activity } from '@/types/domain';
import './ActivityItem.css';

// Icon map for activity types — Lucide components for crisp SVG rendering
const ACTIVITY_TYPE_ICONS: Record<string, LucideIcon> = {
  food:        Utensils,
  attraction:  Camera,
  shopping:    ShoppingBag,
  outdoors:    TreePine,
  cultural:    Landmark,
  note:        FileText,
  other:       Tag,
};

interface ActivityItemProps {
  activity: Activity;
  onEdit: (activity: Activity) => void;
  onDelete: (id: number) => void;
}

export default function ActivityItem({ activity, onEdit, onDelete }: ActivityItemProps): JSX.Element {
  const Icon = ACTIVITY_TYPE_ICONS[activity.activity_type] ?? Tag;
  const timeLabel = activity.timeDisplay() || null;

  return (
    <div className={`activity-item activity-item--${activity.activity_type}`}>
      <span className="activity-item__icon" aria-hidden="true"><Icon size={15} /></span>

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
