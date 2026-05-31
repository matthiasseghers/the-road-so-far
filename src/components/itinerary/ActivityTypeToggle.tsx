import { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useActivityTypes } from '@/hooks/useActivityTypes';
import { resolveIcon } from '@/lib/activityTypeIcons';
import ManageActivityTypesModal from './ManageActivityTypesModal';
import './ActivityTypeToggle.css';

interface ActivityTypeToggleProps {
  value: number | undefined;
  onChange: (id: number) => void;
}

export default function ActivityTypeToggle({ value, onChange }: ActivityTypeToggleProps): JSX.Element {
  const { types, isLoading } = useActivityTypes();
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="at-toggle">
      <div className="at-toggle__row">
        {isLoading ? (
          <span className="at-toggle__loading">Loading…</span>
        ) : (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={2}
            value={value != null ? String(value) : undefined}
            onValueChange={val => { if (val) onChange(Number(val)); }}
            className="at-toggle__group"
          >
            {types.map(t => {
              const Icon = resolveIcon(t.icon_name);
              return (
                <ToggleGroupItem key={t.id} value={String(t.id)} aria-label={t.name}>
                  <Icon size={14} />
                  {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => setManageOpen(true)}
              aria-label="Manage activity types"
            >
              <Settings2 size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Manage types</TooltipContent>
        </Tooltip>
      </div>

      <ManageActivityTypesModal open={manageOpen} onClose={() => setManageOpen(false)} />
    </div>
  );
}
