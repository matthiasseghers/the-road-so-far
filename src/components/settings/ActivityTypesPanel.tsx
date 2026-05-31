import { useState, type KeyboardEvent } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useActivityTypes } from '@/hooks/useActivityTypes';
import IconPicker from '@/components/common/IconPicker';

export default function ActivityTypesPanel(): JSX.Element {
  const { types, isLoading, error, createType, updateType, deleteType, reorderTypes } = useActivityTypes();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<string | null>('tag');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  function moveType(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= types.length) return;
    const ids = types.map(t => t.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorderTypes(ids);
  }

  async function handleAdd(): Promise<void> {
    const name = newName.trim();
    if (!name) return;
    try {
      await createType({ name, icon_name: newIcon });
      setNewName('');
      setNewIcon('tag');
    } catch {
      /* toast handled by hook */
    }
  }

  function startEdit(id: number, name: string): void {
    setEditingId(id);
    setEditValue(name);
  }

  async function commitEdit(id: number): Promise<void> {
    const name = editValue.trim();
    if (name) {
      try { await updateType(id, { name }); } catch { /* toast in hook */ }
    }
    setEditingId(null);
  }

  function handleEditKey(e: KeyboardEvent, id: number): void {
    if (e.key === 'Enter') void commitEdit(id);
    if (e.key === 'Escape') setEditingId(null);
  }

  function handleAddKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') void handleAdd();
  }

  async function handleDelete(id: number): Promise<void> {
    try {
      await deleteType(id);
    } catch {
      /* toast in hook */
    }
  }

  if (isLoading) {
    return (
      <div>
        <h2 className="settings-panel__title">Activity Types</h2>
        <div className="at-list">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 rounded-md" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h2 className="settings-panel__title">Activity Types</h2>
        <div className="flex items-center gap-2 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} aria-hidden />
          Activity types could not be loaded. Please reload the page to try again.
        </div>
      </div>
    );
  }

  const isLast = types.length <= 1;

  return (
    <div>
      <h2 className="settings-panel__title">Activity Types</h2>
      <p className="settings-section__desc" style={{ marginBottom: 'var(--space-5)' }}>
        Manage the types that can be assigned to activities. At least one type must exist.
      </p>

      <div className="at-list">
        {types.map((t, i) => {
          return (
            <div key={t.id} className="at-row">
              <div className="at-row__order">
                <Button variant="ghost" size="icon" className="h-5 w-5"
                  onClick={() => moveType(i, -1)} disabled={i === 0}
                  aria-label={`Move ${t.name} up`}>
                  <ChevronUp size={12} />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5"
                  onClick={() => moveType(i, 1)} disabled={i === types.length - 1}
                  aria-label={`Move ${t.name} down`}>
                  <ChevronDown size={12} />
                </Button>
              </div>

              <IconPicker
                value={t.icon_name}
                onChange={icon => void updateType(t.id, { icon_name: icon })}
              />

              {editingId === t.id ? (
                <Input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => void commitEdit(t.id)}
                  onKeyDown={e => handleEditKey(e, t.id)}
                  className="at-row__input"
                  autoFocus
                  aria-label="Activity type name"
                />
              ) : (
                <span className="at-row__name">{t.name}</span>
              )}

              <div className="at-row__actions">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => startEdit(t.id, t.name)}
                  aria-label={`Rename ${t.name}`}
                >
                  <Pencil size={14} />
                </Button>

                {isLast ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled
                    aria-label="Cannot delete the last activity type"
                  >
                    <Trash2 size={14} />
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={`Delete ${t.name}`}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{t.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. Types that are still used by activities cannot be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void handleDelete(t.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new type */}
      <div className="at-add-row">
        <IconPicker value={newIcon} onChange={setNewIcon} />
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={handleAddKey}
          placeholder="New activity type…"
          className="at-add-row__input"
          aria-label="New activity type name"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleAdd()}
          disabled={!newName.trim()}
        >
          <Plus size={14} />
          Add
        </Button>
      </div>
    </div>
  );
}
