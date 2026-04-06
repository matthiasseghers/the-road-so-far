import { describe, it, expect } from 'vitest';
import {
  LodgingDetailsSchema,
  FlightDetailsSchema,
  TrainDetailsSchema,
  BusDetailsSchema,
  FerryDetailsSchema,
  RentalCarDetailsSchema,
  CreateReservationSchema,
} from '@/schemas/reservation.schema';

// ── LodgingDetailsSchema ──────────────────────────────────────────────────────

describe('LodgingDetailsSchema', () => {
  const validLodging = {
    type: 'lodging' as const,
    property_name: 'Hotel Lisbon',
    location: 'Lisbon',
    check_in_date: '2025-06-10',
    check_out_date: '2025-06-14',
  };

  it('accepts valid lodging details', () => {
    expect(LodgingDetailsSchema.safeParse(validLodging).success).toBe(true);
  });

  it('fails when property_name is missing', () => {
    const result = LodgingDetailsSchema.safeParse({ ...validLodging, property_name: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when location is missing', () => {
    const result = LodgingDetailsSchema.safeParse({ ...validLodging, location: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when check_in_date is missing', () => {
    const result = LodgingDetailsSchema.safeParse({ ...validLodging, check_in_date: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when check_out_date is before check_in_date', () => {
    const result = LodgingDetailsSchema.safeParse({
      ...validLodging,
      check_in_date: '2025-06-14',
      check_out_date: '2025-06-10',
    });
    expect(result.success).toBe(false);
  });

  it('accepts same day check-in/check-out', () => {
    const result = LodgingDetailsSchema.safeParse({
      ...validLodging,
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-10',
    });
    expect(result.success).toBe(true);
  });

  it('fails when same-day check-out time is before check-in time', () => {
    const result = LodgingDetailsSchema.safeParse({
      ...validLodging,
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-10',
      check_in_time: '14:00',
      check_out_time: '11:00',
    });
    expect(result.success).toBe(false);
  });

  it('accepts same-day check-out when check-out time is after check-in time', () => {
    const result = LodgingDetailsSchema.safeParse({
      ...validLodging,
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-10',
      check_in_time: '11:00',
      check_out_time: '14:00',
    });
    expect(result.success).toBe(true);
  });

  it('accepts same-day check-out without times set', () => {
    const result = LodgingDetailsSchema.safeParse({
      ...validLodging,
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-10',
    });
    expect(result.success).toBe(true);
  });
});

// ── FlightDetailsSchema ───────────────────────────────────────────────────────

describe('FlightDetailsSchema', () => {
  const validFlight = {
    type: 'flight' as const,
    airline: 'Ryanair',
    flight_number: 'FR2108',
    depart_date: '2025-06-10',
    arrive_date: '2025-06-10',
  };

  it('accepts valid flight details', () => {
    expect(FlightDetailsSchema.safeParse(validFlight).success).toBe(true);
  });

  it('fails when airline is missing', () => {
    const result = FlightDetailsSchema.safeParse({ ...validFlight, airline: undefined });
    expect(result.success).toBe(false);
  });

  it('fails when arrive_date is before depart_date', () => {
    const result = FlightDetailsSchema.safeParse({
      ...validFlight,
      depart_date: '2025-06-12',
      arrive_date: '2025-06-10',
    });
    expect(result.success).toBe(false);
  });
});

// ── TransitDetailsSchema (Train / Bus / Ferry) ────────────────────────────────

describe.each([
  { type: 'train' as const, schema: TrainDetailsSchema },
  { type: 'bus'   as const, schema: BusDetailsSchema },
  { type: 'ferry' as const, schema: FerryDetailsSchema },
])('$type details schema – same-day time refinement', ({ type, schema }) => {
  const valid = {
    type,
    from_stop: 'A',
    from_date: '2025-06-10',
    to_stop: 'B',
    to_date: '2025-06-10',
  };

  it('accepts same-day trip without times', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('accepts same-day trip when to_time is after from_time', () => {
    expect(schema.safeParse({ ...valid, from_time: '09:00', to_time: '11:00' }).success).toBe(true);
  });

  it('fails when same-day to_time is before from_time', () => {
    expect(schema.safeParse({ ...valid, from_time: '11:00', to_time: '09:00' }).success).toBe(false);
  });

  it('accepts different days even when to_time is before from_time', () => {
    expect(schema.safeParse({ ...valid, to_date: '2025-06-11', from_time: '23:00', to_time: '07:00' }).success).toBe(true);
  });
});

// ── RentalCarDetailsSchema ────────────────────────────────────────────────────

describe('RentalCarDetailsSchema – same-day time refinement', () => {
  const valid = {
    type: 'rental_car' as const,
    company: 'Hertz',
    pickup_location: 'Airport',
    pickup_date: '2025-06-10',
    dropoff_location: 'City centre',
    dropoff_date: '2025-06-10',
  };

  it('accepts same-day rental without times', () => {
    expect(RentalCarDetailsSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts same-day rental when dropoff_time is after pickup_time', () => {
    expect(RentalCarDetailsSchema.safeParse({ ...valid, pickup_time: '08:00', dropoff_time: '18:00' }).success).toBe(true);
  });

  it('fails when same-day dropoff_time is before pickup_time', () => {
    expect(RentalCarDetailsSchema.safeParse({ ...valid, pickup_time: '18:00', dropoff_time: '08:00' }).success).toBe(false);
  });

  it('accepts multi-day rental even when dropoff_time is before pickup_time', () => {
    expect(RentalCarDetailsSchema.safeParse({ ...valid, dropoff_date: '2025-06-12', pickup_time: '23:00', dropoff_time: '08:00' }).success).toBe(true);
  });
});

// ── CreateReservationSchema ───────────────────────────────────────────────────

describe('CreateReservationSchema', () => {
  const validReservation = {
    trip_id: 1,
    type: 'lodging' as const,
    title: 'Hotel Lisbon',
    status: 'confirmed' as const,
    details: {
      type: 'lodging' as const,
      property_name: 'Hotel Lisbon',
      location: 'Lisbon',
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-14',
    },
  };

  it('accepts a valid lodging reservation', () => {
    const result = CreateReservationSchema.safeParse(validReservation);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Hotel Lisbon');
      expect(result.data.cost_currency).toBe('EUR'); // default
    }
  });

  it('accepts a valid flight reservation', () => {
    const result = CreateReservationSchema.safeParse({
      trip_id: 1,
      type: 'flight',
      title: 'Ryanair to Lisbon',
      details: {
        type: 'flight',
        airline: 'Ryanair',
        flight_number: 'FR2108',
        depart_date: '2025-06-10',
        arrive_date: '2025-06-11',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts when title is missing (auto-generated by repo)', () => {
    const result = CreateReservationSchema.safeParse({ ...validReservation, title: undefined });
    expect(result.success).toBe(true);
  });

  it('fails when trip_id is missing', () => {
    const result = CreateReservationSchema.safeParse({ ...validReservation, trip_id: undefined });
    expect(result.success).toBe(false);
  });

  it('defaults status to pending when omitted', () => {
    const result = CreateReservationSchema.safeParse({ ...validReservation, status: undefined });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
    }
  });

  it('fails when lodging check_out_date is before check_in_date', () => {
    const result = CreateReservationSchema.safeParse({
      ...validReservation,
      details: {
        type: 'lodging',
        property_name: 'Hotel X',
        location: 'Paris',
        check_in_date: '2025-06-14',
        check_out_date: '2025-06-10',
      },
    });
    expect(result.success).toBe(false);
  });
});
