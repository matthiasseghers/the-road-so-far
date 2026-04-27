import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/db/api-client';
import { Reservation } from '@/domain/Reservation';
import type { ReservationRow, ReservationType } from '@/types/db';
import type { CreateReservationInput, UpdateReservationInput } from '@/db/repositories/reservations.repo';

export type { CreateReservationInput, UpdateReservationInput };

interface UseReservationsReturn {
  reservations: Reservation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  byType: (type: ReservationType) => Reservation[];
  forDay: (dayId: number) => Reservation[];
  /** Returns all lodging reservations whose date range covers the given ISO date. */
  lodgingsForDate: (dateISO: string) => Reservation[];
  createReservation: (input: CreateReservationInput) => Promise<Reservation>;
  updateReservation: (id: number, input: UpdateReservationInput) => Promise<Reservation>;
  deleteReservation: (id: number) => Promise<void>;
}

export function useReservations(tripId: number): UseReservationsReturn {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback((): void => {
    setIsLoading(true);
    api.get<ReservationRow[]>(`/reservations?tripId=${tripId}`)
      .then(rows => {
        setReservations(rows.map(r => new Reservation(r)));
        setError(null);
        setIsLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Unknown error');
        setIsLoading(false);
      });
  }, [tripId]);

  useEffect(() => { refetch(); }, [refetch]);

  const byType = useCallback(
    (type: ReservationType): Reservation[] => reservations.filter(r => r.type === type),
    [reservations],
  );

  const forDay = useCallback(
    (dayId: number): Reservation[] => reservations.filter(r => r.day_id === dayId),
    [reservations],
  );

  const lodgingsForDate = useCallback(
    (dateISO: string): Reservation[] =>
      reservations.filter(r => r.isLodging() && r.coversDay(dateISO)),
    [reservations],
  );

  const createReservation = useCallback(
    async (input: CreateReservationInput): Promise<Reservation> => {
      try {
        const row = await api.post<ReservationRow>('/reservations', input);
        const reservation = new Reservation(row);
        refetch();
        toast.success('Reservation saved');
        return reservation;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save reservation');
        throw err;
      }
    },
    [refetch],
  );

  const updateReservation = useCallback(
    async (id: number, input: UpdateReservationInput): Promise<Reservation> => {
      try {
        const row = await api.patch<ReservationRow>(`/reservations/${id}`, input);
        const reservation = new Reservation(row);
        refetch();
        toast.success('Reservation updated');
        return reservation;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update reservation');
        throw err;
      }
    },
    [refetch],
  );

  const deleteReservation = useCallback(
    async (id: number): Promise<void> => {
      try {
        await api.delete(`/reservations/${id}`);
        refetch();
        toast.success('Reservation deleted');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete reservation');
      }
    },
    [refetch],
  );

  return {
    reservations,
    isLoading,
    error,
    refetch,
    byType,
    forDay,
    lodgingsForDate,
    createReservation,
    updateReservation,
    deleteReservation,
  };
}
