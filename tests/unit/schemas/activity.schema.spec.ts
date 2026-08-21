import { describe, it, expect } from 'vitest';
import { CreateActivitySchema, PatchActivitySchema } from '@/schemas/activity.schema';

const validActivity = {
  day_id: 1,
  trip_id: 1,
  title: 'Visit Louvre',
  activity_type_id: 1,
};

describe('CreateActivitySchema', () => {
  it('accepts a valid activity', () => {
    const result = CreateActivitySchema.safeParse(validActivity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Visit Louvre');
      expect(result.data.activity_type_id).toBe(1);
    }
  });

  it('accepts activity_type_id as a positive integer', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, activity_type_id: 3 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.activity_type_id).toBe(3);
  });

  it('fails when activity_type_id is missing', () => {
    const { activity_type_id: _, ...noType } = validActivity;
    const result = CreateActivitySchema.safeParse(noType);
    expect(result.success).toBe(false);
  });

  it('fails when activity_type_id is zero or negative', () => {
    expect(CreateActivitySchema.safeParse({ ...validActivity, activity_type_id: 0 }).success).toBe(false);
    expect(CreateActivitySchema.safeParse({ ...validActivity, activity_type_id: -1 }).success).toBe(false);
  });

  it('fails when title is missing', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, title: undefined });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors['title']).toBeDefined();
    }
  });

  it('fails when title is empty string', () => {
    expect(CreateActivitySchema.safeParse({ ...validActivity, title: '' }).success).toBe(false);
  });

  it('fails when trip_id is missing', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, trip_id: undefined });
    expect(result.success).toBe(false);
  });

  it('accepts null day_id (trip-level activity)', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, day_id: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.day_id).toBeNull();
    }
  });

  it('accepts omitted day_id', () => {
    const result = CreateActivitySchema.safeParse({ trip_id: 1, title: 'Test', activity_type_id: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts valid start_time format', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, start_time: '14:30' });
    expect(result.success).toBe(true);
  });

  it('fails for invalid start_time format (not HH:MM)', () => {
    // The HH:MM regex requires exactly two digits, colon, two digits
    const result = CreateActivitySchema.safeParse({ ...validActivity, start_time: '9:00' });
    expect(result.success).toBe(false);
  });

  it('fails when end_time is given without start_time', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, end_time: '15:00' });
    expect(result.success).toBe(false);
  });

  it('accepts end_time with start_time', () => {
    const result = CreateActivitySchema.safeParse({ ...validActivity, start_time: '14:00', end_time: '15:00' });
    expect(result.success).toBe(true);
  });
});

describe('PatchActivitySchema', () => {
  it('accepts empty object', () => {
    const result = PatchActivitySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('still enforces end_time requires start_time', () => {
    const result = PatchActivitySchema.safeParse({ end_time: '15:00', start_time: null });
    expect(result.success).toBe(false);
  });

  it('leaves sort_order undefined when not provided so repo falls back to DB value', () => {
    const result = PatchActivitySchema.safeParse({ title: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort_order).toBeUndefined();
  });

  it('leaves activity_type_id undefined when not provided so repo falls back to DB value', () => {
    const result = PatchActivitySchema.safeParse({ title: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.activity_type_id).toBeUndefined();
  });

  it('preserves explicit sort_order when provided', () => {
    const result = PatchActivitySchema.safeParse({ sort_order: 5 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sort_order).toBe(5);
  });
});

