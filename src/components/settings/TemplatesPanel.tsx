import { useState, Fragment, type KeyboardEvent, type MouseEvent } from 'react';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useTemplateEditor } from '@/hooks/useTemplateEditor';
import type { TemplateWithItems } from '@/hooks/useTemplateEditor';

export default function TemplatesPanel(): JSX.Element {
  const { templates, isLoading, addTemplate, renameTemplate, deleteTemplate, addItem, deleteItem, reorderItems } = useTemplateEditor();

  // Reason: useTemplateEditor does not expose its error state. This observer
  // subscribes to the same ['templates'] cache entry reactively (enabled: false
  // means it never triggers a fetch — it only reads and observes the cache).
  const { error: templateLoadError } = useQuery<TemplateWithItems[], Error>({
    queryKey: ['templates'],
    // eslint-disable-next-line @typescript-eslint/require-await
    queryFn: async () => [],
    enabled: false,
    staleTime: Infinity,
  });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [newTemplateName, setNewTemplateName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  function toggleExpand(id: number): void {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleAddTemplate(): Promise<void> {
    const name = newTemplateName.trim();
    if (!name) return;
    try {
      await addTemplate(name);
      setNewTemplateName('');
    } catch {
      toast.error('Could not add template');
    }
  }

  function startRename(t: TemplateWithItems): void {
    setRenamingId(t.id);
    setRenameValue(t.name);
  }

  async function commitRename(id: number): Promise<void> {
    const name = renameValue.trim();
    if (name) {
      try { await renameTemplate(id, name); } catch { toast.error('Could not rename'); }
    }
    setRenamingId(null);
  }

  function handleRenameKey(e: KeyboardEvent, id: number): void {
    if (e.key === 'Enter') void commitRename(id);
    if (e.key === 'Escape') setRenamingId(null);
  }

  if (isLoading) {
    return (
      <div>
        <h2 className="settings-panel__title">Templates</h2>
        <div className="template-list">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-md" />)}
        </div>
      </div>
    );
  }

  if (templateLoadError) {
    return (
      <div>
        <h2 className="settings-panel__title">Templates</h2>
        <div className="flex items-center gap-2 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--destructive)', flexShrink: 0 }} aria-hidden />
          Templates could not be loaded. Please reload the page to try again.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="settings-panel__title">Templates</h2>
      <p className="settings-section__desc" style={{ marginBottom: 'var(--space-5)' }}>
        Templates are copied to the checklist when you create a new trip. Base templates cannot be deleted.
      </p>

      <div className="template-list">
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            expanded={expandedIds.has(t.id)}
            renaming={renamingId === t.id}
            renameValue={renameValue}
            onToggle={() => toggleExpand(t.id)}
            onStartRename={() => startRename(t)}
            onRenameChange={setRenameValue}
            onRenameKey={e => handleRenameKey(e, t.id)}
            onRenameBlur={() => void commitRename(t.id)}
            onDelete={() => void deleteTemplate(t.id)}
            onAddItem={(label, category) => void addItem(t.id, label, category)}
            onDeleteItem={itemId => void deleteItem(t.id, itemId)}
            onReorderItems={ids => reorderItems(t.id, ids)}
          />
        ))}
      </div>

      {/* Add new template */}
      <div className="template-add-row" style={{ marginTop: 'var(--space-4)' }}>
        <Input
          placeholder="New template name…"
          value={newTemplateName}
          onChange={e => setNewTemplateName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleAddTemplate(); }}
        />
        <Button variant="outline" onClick={() => void handleAddTemplate()}>
          <Plus size={14} /> Add template
        </Button>
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: TemplateWithItems;
  expanded: boolean;
  renaming: boolean;
  renameValue: string;
  onToggle: () => void;
  onStartRename: () => void;
  onRenameChange: (v: string) => void;
  onRenameKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  onRenameBlur: () => void;
  onDelete: () => void;
  onAddItem: (label: string, category: string) => void;
  onDeleteItem: (id: number) => void;
  onReorderItems: (ids: number[]) => void;
}

function TemplateCard({
  template,
  expanded,
  renaming,
  renameValue,
  onToggle,
  onStartRename,
  onRenameChange,
  onRenameKey,
  onRenameBlur,
  onDelete,
  onAddItem,
  onDeleteItem,
  onReorderItems,
}: TemplateCardProps): JSX.Element {
  const [newLabel, setNewLabel] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);
  const [dropTargetItemId, setDropTargetItemId] = useState<number | null>(null);
  const isBase = template.is_base === 1;

  function handleDrop(targetId: number): void {
    if (draggedItemId === null || draggedItemId === targetId) { setDraggedItemId(null); setDropTargetItemId(null); return; }
    const ids = template.items.map(i => i.id);
    const fromIdx = ids.indexOf(draggedItemId);
    const toIdx   = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedItemId);
    onReorderItems(ids);
    setDraggedItemId(null);
    setDropTargetItemId(null);
  }

  function handleAddItem(): void {
    const label = newLabel.trim();
    if (!label) return;
    onAddItem(label, newCategory || 'General');
    setNewLabel('');
  }

  return (
    <div className="template-card">
      <div className="template-card__header" onClick={onToggle}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}

        {renaming ? (
          <input
            autoFocus
            className="template-card__name-input"
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onKeyDown={onRenameKey}
            onBlur={onRenameBlur}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="template-card__name"
            onDoubleClick={e => { e.stopPropagation(); if (!isBase) onStartRename(); }}
          >
            {template.name}
            {isBase && <span style={{ color: 'var(--text-muted)', fontSize: '11px', marginLeft: '6px' }}>base</span>}
          </span>
        )}

        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', marginRight: 'var(--space-2)' }}>
          {template.items.length} item{template.items.length !== 1 ? 's' : ''}
        </span>

        {!isBase && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={(e: MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
              >
                <Trash2 size={13} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{template.name}&rdquo; and all its items. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {expanded && (
        <div className="template-card__items">
          {template.items.map(item => (
            <Fragment key={item.id}>
              {dropTargetItemId === item.id && draggedItemId !== null && draggedItemId !== item.id && (
                <div className="template-item-drop-indicator" />
              )}
              <div
                className="template-item-row"
                draggable
                onDragStart={() => setDraggedItemId(item.id)}
                onDragOver={e => { e.preventDefault(); setDropTargetItemId(item.id); }}
                onDrop={() => handleDrop(item.id)}
                onDragEnd={() => { setDraggedItemId(null); setDropTargetItemId(null); }}
              >
              <GripVertical size={13} className="template-item-row__grip" />
              <span className="template-item-row__label">{item.label}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginRight: 'var(--space-2)' }}>
                {item.category}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => onDeleteItem(item.id)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
            </Fragment>
          ))}

          {/* Add item row */}
          <div className="template-add-row" style={{ marginTop: 'var(--space-2)' }}>
            <Input
              placeholder="Item label…"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); }}
              className="flex-1"
            />
            <Input
              placeholder="Category"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-28"
            />
            <Button variant="outline" onClick={handleAddItem}>
              <Plus size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
