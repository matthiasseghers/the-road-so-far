import { Router, type Request, type Response } from 'express';
import * as tripsRepo from '../src/db/repositories/trips.repo.js';
import * as daysRepo from '../src/db/repositories/days.repo.js';
import * as activitiesRepo from '../src/db/repositories/activities.repo.js';
import * as reservationsRepo from '../src/db/repositories/reservations.repo.js';
import * as checklistRepo from '../src/db/repositories/checklist.repo.js';
import * as settingsRepo from '../src/db/repositories/settings.repo.js';
import { syncDaysForTrip } from '../src/services/days.service.js';
import { CreateTripSchema, PatchTripSchema } from '../src/schemas/trip.schema.js';
import { CreateActivitySchema, PatchActivitySchema } from '../src/schemas/activity.schema.js';
import { CreateReservationSchema, UpdateReservationSchema } from '../src/schemas/reservation.schema.js';
import { CreateChecklistItemSchema, PatchChecklistItemSchema } from '../src/schemas/checklist.schema.js';
import { z } from 'zod';

export const router = Router();

// ── Health check ─────────────────────────────────────────────────────────────

router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// ── Trips ─────────────────────────────────────────────────────────────────────

router.get('/trips', (_req: Request, res: Response) => {
  res.json(tripsRepo.findAllTrips());
});

router.post('/trips', (req: Request, res: Response) => {
  const parsed = CreateTripSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const trip = tripsRepo.createTrip(parsed.data);
  if (trip.start_date && trip.end_date) {
    syncDaysForTrip(trip.id, trip.start_date, trip.end_date);
  }
  res.status(201).json(trip);
});

router.get('/trips/:id/full', (req: Request, res: Response) => {
  const trip = tripsRepo.findTripWithDays(Number(req.params['id']));
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(trip);
});

router.get('/trips/:id', (req: Request, res: Response) => {
  const trip = tripsRepo.findTripById(Number(req.params['id']));
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(trip);
});

router.patch('/trips/:id', (req: Request, res: Response) => {
  const parsed = PatchTripSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const trip = tripsRepo.updateTrip(Number(req.params['id']), parsed.data);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  if (trip.start_date && trip.end_date) {
    syncDaysForTrip(trip.id, trip.start_date, trip.end_date);
  }
  res.json(trip);
});

router.delete('/trips/:id', (req: Request, res: Response) => {
  tripsRepo.deleteTrip(Number(req.params['id']));
  res.status(204).send();
});

// ── Days ──────────────────────────────────────────────────────────────────────

router.get('/days', (req: Request, res: Response) => {
  const tripId = Number(req.query['tripId']);
  if (!tripId) { res.status(400).json({ error: 'tripId query param required' }); return; }
  res.json(daysRepo.findDaysByTripId(tripId));
});

const PatchDaySchema = z.object({
  title:    z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  notes:    z.string().nullable().optional(),
});

router.patch('/days/:id', (req: Request, res: Response) => {
  const parsed = PatchDaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const day = daysRepo.updateDay(Number(req.params['id']), parsed.data);
  if (!day) { res.status(404).json({ error: 'Day not found' }); return; }
  res.json(day);
});

// ── Activities ────────────────────────────────────────────────────────────────

router.get('/activities', (req: Request, res: Response) => {
  if (req.query['dayId']) {
    res.json(activitiesRepo.findActivitiesByDayId(Number(req.query['dayId'])));
  } else if (req.query['tripId']) {
    res.json(activitiesRepo.findActivitiesByTripId(Number(req.query['tripId'])));
  } else {
    res.status(400).json({ error: 'dayId or tripId query param required' });
  }
});

router.post('/activities', (req: Request, res: Response) => {
  const parsed = CreateActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const activity = activitiesRepo.createActivity(parsed.data);
  res.status(201).json(activity);
});

// Reason: PUT /activities/reorder must be before /:id (same pattern as stops).
router.put('/activities/reorder', (req: Request, res: Response) => {
  const { dayId, orderedIds } = req.body as { dayId: number; orderedIds: number[] };
  activitiesRepo.reorderActivities(dayId, orderedIds);
  res.status(204).send();
});

router.patch('/activities/:id', (req: Request, res: Response) => {
  const parsed = PatchActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const activity = activitiesRepo.updateActivity(
    Number(req.params['id']),
    parsed.data,
  );
  if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }
  res.json(activity);
});

router.delete('/activities/:id', (req: Request, res: Response) => {
  activitiesRepo.deleteActivity(Number(req.params['id']));
  res.status(204).send();
});

// ── Reservations ──────────────────────────────────────────────────────────

router.get('/reservations', (req: Request, res: Response) => {
  if (req.query['tripId']) {
    res.json(reservationsRepo.findAllByTripId(Number(req.query['tripId'])));
  } else if (req.query['dayId']) {
    res.json(reservationsRepo.findAllByDayId(Number(req.query['dayId'])));
  } else {
    res.status(400).json({ error: 'tripId or dayId query param required' });
  }
});

router.post('/reservations', (req: Request, res: Response) => {
  const parsed = CreateReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  // Lodging overlap detection
  if (parsed.data.type === 'lodging') {
    const d = parsed.data.details as { check_in_date?: string; check_out_date?: string };
    if (d.check_in_date && d.check_out_date) {
      const conflict = reservationsRepo.findLodgingOverlap(
        parsed.data.trip_id, d.check_in_date, d.check_out_date,
      );
      if (conflict) {
        res.status(409).json({ error: 'overlap', conflictingTitle: conflict.title });
        return;
      }
    }
  }

  const reservation = reservationsRepo.createReservation(parsed.data);
  res.status(201).json(reservation);
});

router.get('/reservations/:id', (req: Request, res: Response) => {
  const reservation = reservationsRepo.findById(Number(req.params['id']));
  if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return; }
  res.json(reservation);
});

router.patch('/reservations/:id', (req: Request, res: Response) => {
  const parsed = UpdateReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  // Lodging overlap detection on edit
  if (parsed.data.type === 'lodging' || parsed.data.details?.type === 'lodging') {
    const d = parsed.data.details as { check_in_date?: string; check_out_date?: string } | undefined;
    if (d?.check_in_date && d?.check_out_date) {
      const existing = reservationsRepo.findById(Number(req.params['id']));
      const conflict = reservationsRepo.findLodgingOverlap(
        existing?.trip_id ?? 0, d.check_in_date, d.check_out_date,
        Number(req.params['id']),
      );
      if (conflict) {
        res.status(409).json({ error: 'overlap', conflictingTitle: conflict.title });
        return;
      }
    }
  }

  const reservation = reservationsRepo.updateReservation(
    Number(req.params['id']),
    parsed.data,
  );
  if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return; }
  res.json(reservation);
});

// Reason: PATCH /days/:dayId/reorder handles unified reorder of activities + reservations.
const ReorderItemsSchema = z.object({
  items: z.array(z.object({ id: z.number().int().positive(), itemType: z.enum(['activity', 'reservation']) })),
});

router.patch('/days/:dayId/reorder', (req: Request, res: Response) => {
  const parsed = ReorderItemsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  reservationsRepo.reorderDayItems(Number(req.params['dayId']), parsed.data.items);
  res.status(204).send();
});

router.delete('/reservations/:id', (req: Request, res: Response) => {
  reservationsRepo.deleteReservation(Number(req.params['id']));
  res.status(204).send();
});

// ── Checklist items ───────────────────────────────────────────────────────────

router.get('/checklist-items', (req: Request, res: Response) => {
  const tripId = Number(req.query['tripId']);
  if (!tripId) { res.status(400).json({ error: 'tripId query param required' }); return; }
  res.json(checklistRepo.findChecklistItemsByTripId(tripId));
});

router.post('/checklist-items', (req: Request, res: Response) => {
  const parsed = CreateChecklistItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = checklistRepo.createChecklistItem(parsed.data);
  res.status(201).json(item);
});

router.post('/checklist-items/copy-templates', (req: Request, res: Response) => {
  const { tripId, templateIds } = req.body as { tripId: number; templateIds: number[] };
  const items = checklistRepo.copyTemplatesToTrip(tripId, templateIds);
  res.status(201).json(items);
});

router.patch('/checklist-items/:id', (req: Request, res: Response) => {
  const parsed = PatchChecklistItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = checklistRepo.updateChecklistItem(Number(req.params['id']), parsed.data);
  if (!item) { res.status(404).json({ error: 'Checklist item not found' }); return; }
  res.json(item);
});

router.delete('/checklist-items/:id', (req: Request, res: Response) => {
  checklistRepo.deleteChecklistItem(Number(req.params['id']));
  res.status(204).send();
});

// ── Checklist templates ───────────────────────────────────────────────────────

router.get('/checklist-templates', (_req: Request, res: Response) => {
  res.json(checklistRepo.findAllTemplates());
});

router.post('/checklist-templates', (req: Request, res: Response) => {
  const template = checklistRepo.createTemplate(req.body as checklistRepo.CreateTemplateInput);
  res.status(201).json(template);
});

router.get('/checklist-templates/:id', (req: Request, res: Response) => {
  const template = checklistRepo.findTemplateById(Number(req.params['id']));
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(template);
});

router.patch('/checklist-templates/:id', (req: Request, res: Response) => {
  const template = checklistRepo.updateTemplate(
    Number(req.params['id']),
    req.body as checklistRepo.UpdateTemplateInput,
  );
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(template);
});

router.delete('/checklist-templates/:id', (req: Request, res: Response) => {
  try {
    checklistRepo.deleteTemplate(Number(req.params['id']));
    res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.get('/template-items', (req: Request, res: Response) => {
  const templateId = Number(req.query['templateId']);
  if (!templateId) { res.status(400).json({ error: 'templateId query param required' }); return; }
  res.json(checklistRepo.findTemplateItems(templateId));
});

// ── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (_req: Request, res: Response) => {
  res.json(settingsRepo.getAllSettings());
});

router.put('/settings/:key', (req: Request, res: Response) => {
  const { value } = req.body as { value: unknown };
  // Reason: Express params are always string at runtime; bracket access types as string | string[] in some @types/express versions
  const key = req.params['key'] as string;
  settingsRepo.setSetting(key, value);
  res.status(204).send();
});
