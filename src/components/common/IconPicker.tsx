import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ACTIVITY_TYPE_ICON_MAP, AVAILABLE_ICONS, resolveIcon } from '@/lib/activityTypeIcons';
import './IconPicker.css';

interface IconPickerProps {
  value: string | null;
  onChange: (iconName: string) => void;
}

export default function IconPicker({ value, onChange }: IconPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" type="button"
          aria-label="Pick icon">
          {resolveIcon(value)({ size: 16 })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="icon-picker__grid">
          {AVAILABLE_ICONS.map(name => {
            const Icon = ACTIVITY_TYPE_ICON_MAP[name];
            const isActive = value === name;
            return (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`icon-picker__btn${isActive ? ' icon-picker__btn--active' : ''}`}
                    onClick={() => { onChange(name); setOpen(false); }}
                    aria-label={name}
                  >
                    <Icon size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
