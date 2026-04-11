import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import './TripFilterBar.css';

interface TripFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  allTags: string[];
  activeTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TripFilterBar({
  search,
  onSearchChange,
  allTags,
  activeTags,
  onTagsChange,
}: TripFilterBarProps): JSX.Element {
  return (
    <div className="filter-bar">
      <div className="filter-bar__search">
        <Search size={15} className="filter-bar__search-icon" />
        <Input
          className="filter-bar__search-input"
          type="text"
          placeholder="Search trips…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        {search && (
          <Button
            variant="ghost"
            size="sm"
            className="filter-bar__search-clear"
            onClick={() => onSearchChange('')}
            type="button"
            aria-label="Clear search"
          >
            <X size={14} />
          </Button>
        )}
      </div>

      {allTags.length > 0 && (
        // Reason: spacing={2} gives each item its own border-radius (avoids rounded-none
        // override that ToggleGroup applies to middle items when spacing=0).
        <ToggleGroup
          type="multiple"
          value={activeTags}
          onValueChange={onTagsChange}
          spacing={2}
          className="filter-bar__tags"
        >
          {allTags.map(tag => (
            <ToggleGroupItem
              key={tag}
              value={tag}
              className="filter-bar__tag"
            >
              {tag}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
