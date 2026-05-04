import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  const { data: reservations = [], isLoading, error, refetch: rqRefetch } = useQuery({
    queryKey: ['reservations', tripId],
    queryFn: () => api.get<ReservationRow[]>(`/reservations?tripId=${tripId}`),
    staleTime: 30_000,
    select: (rows) => rows.map(r => new Reservation(r)),
  });

  const refetch = (): void => { void rqRefetch(); };

  const createMutation = useMutation({
    mutationFn: (input: CreateReservationInput) => api.post<ReservationRow>('/reservations', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations', tripId] });
      toast.success('Reservation saved');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save reservation');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateReservationInput }) =>
      api.patch<ReservationRow>(`/reservations/${id}`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations', tripId] });
      toast.success('Reservation updated');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update reservation');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<void>(`/reservations/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reservations', tripId] });
      toast.success('Reservation deleted');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to delete reservation');
    },
  });

  const createReservation = async (input: CreateReservationInput): Promise<Reservation> => {
    const row = await createMutation.mutateAsync(input);
    return new Reservation(row);
  };

  const updateReservation = async (id: number, input: UpdateReservationInput): Promise<Reservation> => {
    const row = await updateMutation.mutateAsync({ id, input });
    return new Reservation(row);
  };

  const deleteReservation = async (id: number): Promise<void> => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch {
      // onError already shows the toast; swallow to match original behaviour.
    }
  };

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

  return {
    reservations,
    isLoading,
    error: error ? error.message : null,
    refetch,
    byType,
    forDay,
    lodgingsForDate,
    createReservation,
    updateReservation,
    deleteReservation,
  };
}
