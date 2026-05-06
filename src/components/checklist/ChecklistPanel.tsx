import { useState, useRef, useCallback, useEffect, Fragment } from 'react';
import confetti from 'canvas-confetti';
import { Plus, Check, X, MoreHorizontal, Pencil, Trash2, PackageOpen, LibraryBig } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useChecklist } from '@/hooks/useChecklist';
import { api } from '@/db/api-client';
import type { ChecklistTemplateRow } from '@/types/domain';
import ChecklistItem from './ChecklistItem';
import './ChecklistPanel.css';

// Sentinel value for "show all categories" view
const ALL_KEY = '__all__';

interface ChecklistPanelProps {
  tripId: number;
}

export default function ChecklistPanel({ tripId }: ChecklistPanelProps) {
  const { items, grouped, add, toggle, remove, renameCategory, removeCategory, applyTemplates, reorder, isLoading } = useChecklist(tripId);

  const [activeCategory, setActiveCategory] = useState<string>(ALL_KEY);
  const [newLabel, setNewLabel] = useState('');
  // Locally-created categories that have no items yet
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  // Inline rename state: which category is being renamed + its draft value
  const [renamingCat, setRenamingCat] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  // AlertDialog state: category pending deletion confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  // Template picker state
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<ChecklistTemplateRow[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [applyingTemplates, setApplyingTemplates] = useState(false);
  // Drag-to-reorder state (only active when a single category is selected)
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const occupiedCategories = Object.keys(grouped);
  // Sidebar only shows real trip categories + pending (user-created but empty)
  const allCategories = Array.from(
    new Set([...occupiedCategories, ...pendingCategories]),
  ).sort((a, b) => a.localeCompare(b));

  // Remove a pending category once it has real items
  useEffect(() => {
    setPendingCategories(prev => prev.filter(p => !occupiedCategories.includes(p)));
  // Reason: keep pending list clean — occupied categories are now real
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupiedCategories.join(',')]);

  // Confetti when all items transition to fully checked
  const prevAllChecked = useRef(false);
  useEffect(() => {
    const allChecked = items.length > 0 && items.every(i => i.isChecked);
    if (allChecked && !prevAllChecked.current) {
      void confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
    prevAllChecked.current = allChecked;
  }, [items]);

  const handleAddCategory = useCallback((): void => {
    const name = categoryDraft.trim().toLowerCase();
    if (!name) { setAddingCategory(false); setCategoryDraft(''); return; }
    // Skip if already exists
    if (!allCategories.includes(name)) {
      setPendingCategories(prev => [...prev, name]);
    }
    setActiveCategory(name);
    setAddingCategory(false);
    setCategoryDraft('');
  }, [categoryDraft, allCategories]);

  // Focus the category input when shown
  useEffect(() => {
    if (addingCategory) catInputRef.current?.focus();
  }, [addingCategory]);

  // Focus the rename input when shown
  useEffect(() => {
    if (renamingCat) renameInputRef.current?.focus();
  }, [renamingCat]);

  const handleRenameCommit = useCallback(async (): Promise<void> => {
    const name = renameDraft.trim().toLowerCase();
    if (!name || !renamingCat || name === renamingCat) { setRenamingCat(null); return; }
    await renameCategory(renamingCat, name);
    if (activeCategory === renamingCat) setActiveCategory(name);
    setRenamingCat(null);
  }, [renameDraft, renamingCat, renameCategory, activeCategory]);

  const handleDeleteCategory = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return;
    await removeCategory(deleteTarget);
    if (activeCategory === deleteTarget) setActiveCategory(ALL_KEY);
    setDeleteTarget(null);
  }, [removeCategory, activeCategory, deleteTarget]);

  // Items shown in the right panel
  const visibleItems = activeCategory === ALL_KEY
    ? items
    : (grouped[activeCategory] ?? []);

  const checkedCount = visibleItems.filter(i => i.isChecked).length;
  const totalCount = visibleItems.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // Category is determined entirely by the active view — no user input needed.
  // Items added in "All items" get no category (null); all others get the active category.
  const effectiveCategory: string | null = activeCategory !== ALL_KEY ? activeCategory : null;

  const handleAdd = useCallback(async (): Promise<void> => {
    const label = newLabel.trim();
    if (!label) return;
    await add(label, effectiveCategory);
    setNewLabel('');
    inputRef.current?.focus();
  }, [newLabel, effectiveCategory, add]);

  const handleDrop = useCallback((targetId: number): void => {
    if (draggedId === null || draggedId === targetId) { setDraggedId(null); setDropTargetId(null); return; }
    const currentIds = visibleItems.map(i => i.id);
    const fromIdx = currentIds.indexOf(draggedId);
    const toIdx   = currentIds.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...currentIds];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);
    reorder(reordered);
    setDraggedId(null);
    setDropTargetId(null);
  }, [draggedId, visibleItems, reorder]);

  const handleApplyTemplates = useCallback(async (): Promise<void> => {
    setApplyingTemplates(true);
    try {
      await applyTemplates(Array.from(selectedTemplateIds));
      setTemplatePickerOpen(false);
      setSelectedTemplateIds(new Set());
    } finally {
      setApplyingTemplates(false);
    }
  }, [applyTemplates, selectedTemplateIds]);

  const openTemplatePicker = useCallback((): void => {
    setSelectedTemplateIds(new Set());
    api.get<ChecklistTemplateRow[]>('/checklist-templates')
      .then(data => { setAvailableTemplates(data); setTemplatePickerOpen(true); })
      .catch(() => {});
  }, []);

  const panelTitle = activeCategory === ALL_KEY ? 'All items' : activeCategory;

  return (
    <>
      <div className="cl-layout">
        {/* Left: category navigation card */}
        <nav className="cl-nav" aria-label="Checklist categories">
          <button
            className={`cl-nav-item ${activeCategory === ALL_KEY ? 'cl-nav-item--active' : ''}`}
            onClick={() => setActiveCategory(ALL_KEY)}
          >
            <span className="cl-nav-label">All items</span>
            <Badge variant="secondary" className="cl-nav-badge">
              {items.filter(i => i.isChecked).length}/{items.length}
            </Badge>
          </button>

          {occupiedCategories.length > 0 && <div className="cl-nav-sep" />}

          {allCategories.filter(c => c !== ALL_KEY).map(cat => {
            const catItems = grouped[cat] ?? [];
            const catChecked = catItems.filter(i => i.isChecked).length;
            const isPending = pendingCategories.includes(cat);
            const badgeVariant = !isPending && catItems.length > 0 && catChecked === catItems.length ? 'default' : 'secondary';

            if (renamingCat === cat) {
              return (
                <div key={cat} className="cl-nav-add-form">
                  <input
                    ref={renameInputRef}
                    className="cl-nav-add-input"
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void handleRenameCommit();
                      if (e.key === 'Escape') setRenamingCat(null);
                    }}
                  />
                  <button className="cl-nav-add-confirm" onClick={() => void handleRenameCommit()} aria-label="Confirm rename">
                    <Check size={12} />
                  </button>
                  <button className="cl-nav-add-cancel" onClick={() => setRenamingCat(null)} aria-label="Cancel rename">
                    <X size={12} />
                  </button>
                </div>
              );
            }

            return (
              <div key={cat} className="cl-nav-item-wrap">
                <button
                  className={`cl-nav-item cl-nav-item--has-menu ${activeCategory === cat ? 'cl-nav-item--active' : ''} ${isPending ? 'cl-nav-item--pending' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="cl-nav-label">{cat}</span>
                  {isPending ? (
                    <span className="cl-nav-empty">empty</span>
                  ) : (
                    <Badge variant={badgeVariant} className="cl-nav-badge">
                      {catChecked}/{catItems.length}
                    </Badge>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="cl-nav-menu-btn" aria-label={`Options for ${cat}`} onClick={e => e.stopPropagation()}>
                      <MoreHorizontal size={12} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="right">
                    <DropdownMenuItem onSelect={() => { setRenamingCat(cat); setRenameDraft(cat); }}>
                      <Pencil size={13} /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(cat)}>
                      <Trash2 size={13} /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          <div className="cl-nav-sep" />

          {addingCategory ? (
            <div className="cl-nav-add-form">
              <input
                ref={catInputRef}
                className="cl-nav-add-input"
                placeholder="Category name…"
                value={categoryDraft}
                onChange={e => setCategoryDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') { setAddingCategory(false); setCategoryDraft(''); }
                }}
              />
              <button className="cl-nav-add-confirm" onClick={handleAddCategory} aria-label="Confirm">
                <Check size={12} />
              </button>
              <button className="cl-nav-add-cancel" onClick={() => { setAddingCategory(false); setCategoryDraft(''); }} aria-label="Cancel">
                <X size={12} />
              </button>
            </div>
          ) : (
            <button className="cl-nav-item cl-nav-item--new" onClick={() => setAddingCategory(true)}>
              <Plus size={12} />
              <span className="cl-nav-label">New category</span>
            </button>
          )}

          <button className="cl-nav-item cl-nav-item--new" onClick={openTemplatePicker}>
            <LibraryBig size={12} />
            <span className="cl-nav-label">From template</span>
          </button>
        </nav>

        {/* Right: items panel */}
        <div className="cl-panel">
          <div className="cl-panel-header">
            <span className="cl-panel-title">{panelTitle}</span>
            <span className="cl-panel-count">{checkedCount}/{totalCount} packed</span>
          </div>

          <Progress value={progress} className="cl-panel-progress" />

          <div className="cl-panel-items">
            {isLoading ? (
              <p className="cl-empty">Loading…</p>
            ) : visibleItems.length === 0 ? (
              <div className="cl-empty-state">
                <PackageOpen size={36} className="cl-empty-state__icon" />
                <p className="cl-empty-state__title">Nothing here yet</p>
                <p className="cl-empty-state__sub">Add your first item below.</p>
              </div>
            ) : (
              // Flat list for both All and category views; show badge only in All
              visibleItems.map(item => (
                <Fragment key={item.id}>
                  {dropTargetId === item.id && draggedId !== null && draggedId !== item.id && (
                    <div className="cl-drop-indicator" />
                  )}
                  <ChecklistItem
                    item={item}
                    onToggle={toggle}
                    onDelete={remove}
                    showCategory={activeCategory === ALL_KEY}
                    draggable={activeCategory !== ALL_KEY}
                    onDragStart={setDraggedId}
                    onDragOver={(_, id) => setDropTargetId(id)}
                    onDrop={(_, id) => handleDrop(id)}
                    onDragEnd={() => { setDraggedId(null); setDropTargetId(null); }}
                  />
                </Fragment>
              ))
            )}
          </div>

          {/* Add form */}
          <div className="cl-panel-footer">
            <Input
              ref={inputRef}
              placeholder="Add item…"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => void handleAdd()}
              disabled={!newLabel.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </div>

      {/* AlertDialog: confirm category deletion */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deleteTarget}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              All items in this category will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteCategory()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: apply checklist templates */}
      <Dialog open={templatePickerOpen} onOpenChange={v => { if (!v) { setTemplatePickerOpen(false); setSelectedTemplateIds(new Set()); } }}>
        <DialogContent style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>Apply template</DialogTitle>
          </DialogHeader>
          <DialogBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
            {availableTemplates.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No templates found. Create one in Settings → Templates.</p>
            ) : (
              availableTemplates.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Checkbox
                    id={`tpl-${t.id}`}
                    checked={selectedTemplateIds.has(t.id)}
                    onCheckedChange={checked => {
                      setSelectedTemplateIds(prev => {
                        const next = new Set(prev);
                        if (checked) next.add(t.id); else next.delete(t.id);
                        return next;
                      });
                    }}
                  />
                  <Label htmlFor={`tpl-${t.id}`} style={{ cursor: 'pointer', fontWeight: 500 }}>
                    {t.name}
                  </Label>
                </div>
              ))
            )}
          </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setTemplatePickerOpen(false); setSelectedTemplateIds(new Set()); }} type="button">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleApplyTemplates()}
              disabled={selectedTemplateIds.size === 0 || applyingTemplates}
              type="button"
            >
              {applyingTemplates ? 'Applying…' : `Apply${selectedTemplateIds.size > 0 ? ` (${selectedTemplateIds.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
