import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { ChecklistItem as ChecklistItemType } from '@/domain/ChecklistItem';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onToggle: (id: number, checked: boolean) => void;
  onDelete: (id: number) => void;
  showCategory?: boolean;
}

export default function ChecklistItem({ item, onToggle, onDelete, showCategory }: ChecklistItemProps) {
  const checkboxId = `checklist-item-${item.id}`;
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="group flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-accent/40 transition-colors">
        <Checkbox
          id={checkboxId}
          checked={item.isChecked}
          onCheckedChange={() => onToggle(item.id, !item.isChecked)}
        />
        <label
          htmlFor={checkboxId}
          className={cn(
            'flex-1 text-sm cursor-pointer select-none',
            item.isChecked && 'line-through text-muted-foreground',
          )}
        >
          {item.label}
        </label>
        {showCategory && item.category && (
          <Badge variant="secondary" className="cl-item-cat-badge">
            {item.category}
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          aria-label={`Delete ${item.label}`}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{item.label}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This checklist item will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(item.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
