import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export default function TagInput({
  tags,
  onChange,
  placeholder = 'Add tag…',
  maxTags = 10,
}: TagInputProps): JSX.Element {
  const [input, setInput] = useState('');

  function addTag(raw: string): void {
    const value = raw.trim().toLowerCase();
    // Reason: compare lowercase to catch duplicates regardless of stored casing.
    if (!value || tags.some(t => t.toLowerCase() === value) || tags.length >= maxTags) return;
    onChange([...tags, value]);
    setInput('');
  }

  function removeTag(tag: string): void {
    onChange(tags.filter(t => t !== tag));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Reason: chips render above the input — "already added" items sit above the
          active text entry area, matching the mental model of a growing list. */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                className="flex items-center opacity-70 hover:opacity-100 cursor-pointer outline-none"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                <X size={10} />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {tags.length < maxTags && (
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => addTag(input)}
          placeholder={placeholder}
          type="text"
        />
      )}
    </div>
  );
}
