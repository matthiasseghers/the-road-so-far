import type { ChecklistItemRow } from '@/types/db';

export class ChecklistItem {
  readonly data: ChecklistItemRow;

  constructor(row: ChecklistItemRow) {
    this.data = row;
  }

  get id(): number { return this.data.id; }
  get trip_id(): number { return this.data.trip_id; }
  get label(): string { return this.data.label; }
  get category(): ChecklistItemRow['category'] { return this.data.category; }
  get sort_order(): number { return this.data.sort_order; }
  get source(): 'template' | 'trip' { return this.data.source; }
  get created_at(): string { return this.data.created_at; }

  /** True when the item has been checked off. Maps `is_checked` (0|1) to boolean. */
  get isChecked(): boolean {
    return this.data.is_checked === 1;
  }
}
