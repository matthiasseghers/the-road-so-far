import { describe, it, expect } from 'vitest';
import { CreateTripSchema, PatchTripSchema } from '@/schemas/trip.schema';

const validTrip = {
  title: 'Tokyo Adventure',
  start_date: '2025-10-01',
  end_date: '2025-10-15',
};

describe('CreateTripSchema', () => {
  it('accepts a valid trip', () => {
    const result = CreateTripSchema.safeParse(validTrip);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Tokyo Adventure');
      expect(result.data.emoji).toBe('🗺️');       // default
      expect(result.data.status).toBe('draft');  // default
      expect(result.data.tags).toEqual([]);       // default
    }
  });

  it('fails when title is missing', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, title: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toBeDefined();
    }
  });

  it('fails when title is empty string', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, title: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.title).toBeDefined();
    }
  });

  it('trims whitespace from title', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, title: '  Tokyo  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Tokyo');
    }
  });

  it('fails when start_date is missing', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, start_date: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.start_date).toBeDefined();
    }
  });

  it('fails when end_date is missing', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, end_date: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when end_date is before start_date', () => {
    const result = CreateTripSchema.safeParse({
      ...validTrip,
      start_date: '2025-10-15',
      end_date: '2025-10-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.end_date).toBeDefined();
    }
  });

  it('accepts when start_date equals end_date', () => {
    const result = CreateTripSchema.safeParse({
      ...validTrip,
      start_date: '2025-10-01',
      end_date: '2025-10-01',
    });
    expect(result.success).toBe(true);
  });

  it('fails for invalid date format', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, start_date: '01/10/2025' });
    expect(result.success).toBe(false);
  });

  it('fails for invalid status', () => {
    const result = CreateTripSchema.safeParse({ ...validTrip, status: 'invalid_status' });
    expect(result.success).toBe(false);
  });
});

describe('PatchTripSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = PatchTripSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just title', () => {
    const result = PatchTripSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('still validates dates when both provided', () => {
    const result = PatchTripSchema.safeParse({
      start_date: '2025-10-15',
      end_date: '2025-10-01',
    });
    expect(result.success).toBe(false);
  });

  it('skips date refinement when only start_date is provided', () => {
    // Without end_date there is nothing to compare — should pass.
    const result = PatchTripSchema.safeParse({ start_date: '2025-10-01' });
    expect(result.success).toBe(true);
  });

  it('skips date refinement when only end_date is provided', () => {
    const result = PatchTripSchema.safeParse({ end_date: '2025-10-01' });
    expect(result.success).toBe(true);
  });

  it('accepts equal start_date and end_date', () => {
    const result = PatchTripSchema.safeParse({
      start_date: '2025-10-01',
      end_date: '2025-10-01',
    });
    expect(result.success).toBe(true);
  });

  it('reports error on end_date path when dates are inverted', () => {
    const result = PatchTripSchema.safeParse({
      start_date: '2025-10-15',
      end_date: '2025-10-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors['end_date']).toBeDefined();
    }
  });

  it('accepts valid status values', () => {
    const statuses = ['draft', 'planning', 'confirmed', 'ready', 'completed', 'archived'] as const;
    for (const status of statuses) {
      expect(PatchTripSchema.safeParse({ status }).success).toBe(true);
    }
  });
});
