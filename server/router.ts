import { Router, type Request, type Response } from 'express';
import { getDb } from '../src/db/client.js';
import * as tripsRepo from '../src/db/repositories/trips.repo.js';
import * as daysRepo from '../src/db/repositories/days.repo.js';
import * as activitiesRepo from '../src/db/repositories/activities.repo.js';
import * as reservationsRepo from '../src/db/repositories/reservations.repo.js';
import * as checklistRepo from '../src/db/repositories/checklist.repo.js';
import * as settingsRepo from '../src/db/repositories/settings.repo.js';
import * as routeLegsRepo from '../src/db/repositories/route-legs.repo.js';
import * as legModesRepo from '../src/db/repositories/leg-modes.repo.js';
import * as calendarRepo from '../src/db/repositories/calendar.repo.js';
import { syncDaysForTrip } from '../src/services/days.service.js';
import { geocodePlace } from '../src/services/geocoding.service.js';
import { fetchRouteLeg } from '../src/services/routing.service.js';
import { CreateTripSchema, PatchTripSchema } from '../src/schemas/trip.schema.js';
import { CreateActivitySchema, PatchActivitySchema } from '../src/schemas/activity.schema.js';
import { CreateReservationSchema, UpdateReservationSchema } from '../src/schemas/reservation.schema.js';
import { CreateChecklistItemSchema, PatchChecklistItemSchema } from '../src/schemas/checklist.schema.js';
import { z } from 'zod';

// ── Shared inline schemas (small, single-use, not worth a separate file) ─────

const ReorderActivitiesSchema = z.object({
  dayId:      z.number().int().positive(),
  orderedIds: z.array(z.number().int().positive()),
});
const CopyTemplatesSchema   = z.object({
  tripId:      z.number().int().positive(),
  templateIds: z.array(z.number().int().positive()),
});
const RenameCategorySchema  = z.object({ name: z.string().trim().min(1) });
const TemplateItemCreateSchema = z.object({
  template_id: z.number().int().positive(),
  label:       z.string().trim().min(1),
  category:    z.string().trim().min(1),
});
const TemplateItemPatchSchema = z.object({
  label:    z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
});
const TemplateReorderSchema = z.object({
  templateId: z.number().int().positive(),
  ids:        z.array(z.number().int().positive()),
});
const TripReorderSchema     = z.object({ ids: z.array(z.number().int().positive()) });
const SettingValueSchema    = z.object({ value: z.unknown() });
const TemplateCreateSchema  = z.object({
  name:       z.string().trim().min(1),
  icon_name:  z.string().trim().min(1).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});
const TemplatePatchSchema   = z.object({
  name:       z.string().trim().min(1).optional(),
  icon_name:  z.string().trim().min(1).nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
});

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
  // Seed checklist from all base templates on trip creation
  const baseIds = checklistRepo.findAllTemplates()
    .filter(t => t.is_base === 1)
    .map(t => t.id);
  if (baseIds.length > 0) checklistRepo.copyTemplatesToTrip(trip.id, baseIds);
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

// ── Calendar ──────────────────────────────────────────────────────────────────

router.get('/trips/:tripId/calendar-days', (req: Request, res: Response) => {
  const trip = tripsRepo.findTripById(Number(req.params['tripId']));
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(calendarRepo.getDaysForTrip(Number(req.params['tripId'])));
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
  const parsed = ReorderActivitiesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  activitiesRepo.reorderActivities(parsed.data.dayId, parsed.data.orderedIds);
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

const GeocodeBodySchema = z.object({
  location: z.string().trim().min(1),
  // Reason: when the client already has coordinates from autocomplete, skip
  // the external Nominatim call and use them directly.
  lat: z.number().optional(),
  lng: z.number().optional(),
});

router.patch('/activities/:id/geocode', (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const activity = activitiesRepo.findActivityById(id);
  if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }
  const parsed = GeocodeBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: 'Location is required for geocoding' }); return; }
  // Reason: skip Nominatim round-trip when client already has coordinates from autocomplete.
  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    activitiesRepo.updateActivityLatLng(id, parsed.data.lat, parsed.data.lng);
    res.json(activitiesRepo.findActivityById(id));
    return;
  }
  geocodePlace(parsed.data.location)
    .then(coords => {
      if (!coords) { res.status(503).json({ error: 'Geocoding returned no results' }); return; }
      activitiesRepo.updateActivityLatLng(id, coords.lat, coords.lng);
      res.json(activitiesRepo.findActivityById(id));
    })
    .catch(() => res.status(503).json({ error: 'Geocoding failed' }));
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

  const result = reservationsRepo.createReservationSafe(parsed.data);
  if (!result.ok) {
    res.status(409).json({ error: 'overlap', conflictingTitle: result.conflict });
    return;
  }
  res.status(201).json(result.item);
});

router.get('/reservations/:id', (req: Request, res: Response) => {
  const reservation = reservationsRepo.findById(Number(req.params['id']));
  if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return; }
  res.json(reservation);
});
router.patch('/reservations/:id/geocode', (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  const reservation = reservationsRepo.findById(id);
  if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return; }
  const parsed = GeocodeBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: 'Location is required for geocoding' }); return; }
  // Reason: skip Nominatim round-trip when client already has coordinates from autocomplete.
  if (parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
    reservationsRepo.updateReservationLatLng(id, parsed.data.lat, parsed.data.lng);
    res.json(reservationsRepo.findById(id));
    return;
  }
  geocodePlace(parsed.data.location)
    .then(coords => {
      if (!coords) { res.status(503).json({ error: 'Geocoding returned no results' }); return; }
      reservationsRepo.updateReservationLatLng(id, coords.lat, coords.lng);
      res.json(reservationsRepo.findById(id));
    })
    .catch(() => res.status(503).json({ error: 'Geocoding failed' }));
});
router.patch('/reservations/:id', (req: Request, res: Response) => {
  const parsed = UpdateReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const result = reservationsRepo.updateReservationSafe(Number(req.params['id']), parsed.data);
  if (result === null) { res.status(404).json({ error: 'Reservation not found' }); return; }
  if (!result.ok) {
    res.status(409).json({ error: 'overlap', conflictingTitle: result.conflict });
    return;
  }
  res.json(result.item);
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
  const parsed = CopyTemplatesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const { items, inserted, skipped } = checklistRepo.copyTemplatesToTrip(parsed.data.tripId, parsed.data.templateIds);
  res.status(201).json({ items, inserted, skipped });
});

router.put('/trips/:tripId/checklist/reorder', (req: Request, res: Response) => {
  const parsed = TripReorderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const tripId = Number(req.params['tripId']);
  checklistRepo.reorderChecklistItems(tripId, parsed.data.ids);
  res.status(204).send();
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

// ── Checklist RESTful routes ─────────────────────────────────────────────────

router.get('/trips/:tripId/checklist', (req: Request, res: Response) => {
  const tripId = Number(req.params['tripId']);
  res.json(checklistRepo.findChecklistItemsByTripId(tripId));
});

router.post('/trips/:tripId/checklist', (req: Request, res: Response) => {
  const tripId = Number(req.params['tripId']);
  const parsed = CreateChecklistItemSchema.safeParse({ ...req.body, trip_id: tripId });
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = checklistRepo.createChecklistItem(parsed.data);
  res.status(201).json(item);
});

router.patch('/trips/:tripId/checklist/:id', (req: Request, res: Response) => {
  const tripId = Number(req.params['tripId']);
  const id = Number(req.params['id']);
  const existing = checklistRepo.findChecklistItemById(id);
  if (!existing || existing.trip_id !== tripId) {
    res.status(404).json({ error: 'Checklist item not found' });
    return;
  }
  const parsed = PatchChecklistItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = checklistRepo.updateChecklistItem(id, parsed.data);
  res.json(item);
});

router.delete('/trips/:tripId/checklist/:id', (req: Request, res: Response) => {
  const tripId = Number(req.params['tripId']);
  const id = Number(req.params['id']);
  const existing = checklistRepo.findChecklistItemById(id);
  if (!existing || existing.trip_id !== tripId) {
    res.status(404).json({ error: 'Checklist item not found' });
    return;
  }
  checklistRepo.deleteChecklistItem(id);
  res.status(204).send();
});

// Reason: /category/:cat routes must appear before /:id to prevent Express matching 'category' as an id
router.patch('/trips/:tripId/checklist/category/:cat', (req: Request, res: Response) => {
  const parsed = RenameCategorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const tripId = Number(req.params['tripId']);
  const oldCat = decodeURIComponent(req.params['cat'] as string);
  checklistRepo.renameChecklistCategory(tripId, oldCat, parsed.data.name.toLowerCase());
  res.status(204).send();
});

router.delete('/trips/:tripId/checklist/category/:cat', (req: Request, res: Response) => {
  const tripId = Number(req.params['tripId']);
  const cat = decodeURIComponent(req.params['cat'] as string);
  checklistRepo.deleteChecklistItemsByCategory(tripId, cat);
  res.status(204).send();
});

// ── Checklist templates ───────────────────────────────────────────────────────

// Reason: /categories must be declared before /:id to prevent Express routing 'categories' as an id param
router.get('/checklist-templates/categories', (_req: Request, res: Response) => {
  res.json(checklistRepo.getDistinctCategories());
});

router.get('/checklist-templates', (_req: Request, res: Response) => {
  res.json(checklistRepo.findAllTemplates());
});

router.post('/checklist-templates', (req: Request, res: Response) => {
  const parsed = TemplateCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const template = checklistRepo.createTemplate(parsed.data);
  res.status(201).json(template);
});

router.get('/checklist-templates/:id', (req: Request, res: Response) => {
  const template = checklistRepo.findTemplateById(Number(req.params['id']));
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(template);
});

router.patch('/checklist-templates/:id', (req: Request, res: Response) => {
  const parsed = TemplatePatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const template = checklistRepo.updateTemplate(
    Number(req.params['id']),
    parsed.data,
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

router.post('/template-items', (req: Request, res: Response) => {
  const parsed = TemplateItemCreateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const item = checklistRepo.createTemplateItem(parsed.data.template_id, parsed.data.label, parsed.data.category);
  res.status(201).json(item);
});

router.patch('/template-items/:id', (req: Request, res: Response) => {
  const parsed = TemplateItemPatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const item = checklistRepo.updateTemplateItem(
    Number(req.params['id']),
    parsed.data,
  );
  if (!item) { res.status(404).json({ error: 'Template item not found' }); return; }
  res.json(item);
});

router.delete('/template-items/:id', (req: Request, res: Response) => {
  checklistRepo.deleteTemplateItem(Number(req.params['id']));
  res.status(204).send();
});

router.put('/template-items/reorder', (req: Request, res: Response) => {
  const parsed = TemplateReorderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  checklistRepo.reorderTemplateItems(parsed.data.templateId, parsed.data.ids);
  res.status(204).send();
});

// ── Global map ───────────────────────────────────────────────────────────────

// Reason: returns all geocoded activities + reservations across all trips in one
// flat list so the global MapPage can render without per-trip fetch loops.
router.get('/map/pins', (_req: Request, res: Response) => {
  const db = getDb();

  const activities = db.prepare(`
    SELECT a.id, a.title, a.start_time, a.lat, a.lng,
           t.id   AS trip_id,
           t.title AS trip_title,
           d.date  AS day_date
    FROM   activities a
    JOIN   days d  ON d.id  = a.day_id
    JOIN   trips t ON t.id  = d.trip_id
    WHERE  a.lat IS NOT NULL AND a.lng IS NOT NULL
  `).all() as Array<{
    id: number; title: string; start_time: string | null;
    lat: number; lng: number;
    trip_id: number; trip_title: string; day_date: string;
  }>;

  const reservations = db.prepare(`
    SELECT r.id, r.title, r.type, r.lat, r.lng,
           t.id    AS trip_id,
           t.title AS trip_title,
           d.date  AS day_date
    FROM   reservations r
    JOIN   trips t ON t.id = r.trip_id
    LEFT JOIN days d ON d.id = r.day_id
    WHERE  r.lat IS NOT NULL AND r.lng IS NOT NULL
  `).all() as Array<{
    id: number; title: string; type: string;
    lat: number; lng: number;
    trip_id: number; trip_title: string; day_date: string | null;
  }>;

  // Reason: include trip metadata so the client can show date ranges in the legend
  // without a second round-trip. Ordered by start_date for consistent palette assignment.
  const trips = db.prepare(`
    SELECT DISTINCT t.id, t.title, t.start_date, t.end_date
    FROM   trips t
    WHERE  t.id IN (
      SELECT DISTINCT trip_id FROM activities   WHERE lat IS NOT NULL AND lng IS NOT NULL
      UNION
      SELECT DISTINCT trip_id FROM reservations WHERE lat IS NOT NULL AND lng IS NOT NULL
    )
    ORDER BY t.start_date
  `).all() as Array<{ id: number; title: string; start_date: string | null; end_date: string | null }>;

  res.json({ activities, reservations, trips });
});

// ── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (_req: Request, res: Response) => {
  res.json(settingsRepo.getAllSettings());
});

// Reason: whitelist prevents arbitrary keys from being written to the settings table
// by non-browser HTTP clients that bypass the frontend's fixed set of setting keys.
const ALLOWED_SETTING_KEYS = ['theme', 'distance_unit', 'date_format', 'time_areas', 'tomtom_api_key'] as const;
type AllowedSettingKey = typeof ALLOWED_SETTING_KEYS[number];

router.put('/settings/:key', (req: Request, res: Response) => {
  const parsed = SettingValueSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  // Reason: Express params are always string at runtime; bracket access types as string | string[] in some @types/express versions
  const key = req.params['key'] as string;
  if (!ALLOWED_SETTING_KEYS.includes(key as AllowedSettingKey)) {
    res.status(400).json({ error: `Unknown setting key: ${key}` });
    return;
  }
  settingsRepo.setSetting(key, parsed.data.value);
  res.status(204).send();
});

// ── Data export / wipe ────────────────────────────────────────────────────────

router.get('/export/all', (_req: Request, res: Response) => {
  const trips = tripsRepo.findAllTrips();
  const allDays = trips.flatMap(t => daysRepo.findDaysByTripId(t.id));
  const allActivities = trips.flatMap(t => activitiesRepo.findActivitiesByTripId(t.id));
  const allReservations = trips.flatMap(t => reservationsRepo.findAllByTripId(t.id));
  const allChecklistItems = trips.flatMap(t =>
    checklistRepo.findChecklistItemsByTripId(t.id),
  );
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    trips,
    days: allDays,
    activities: allActivities,
    reservations: allReservations,
    checklistItems: allChecklistItems,
  });
});

// Per-trip .trippack export — same shape as /export/all but scoped to one trip.
router.get('/trips/:tripId/export/trippack', (req: Request, res: Response) => {
  const tripId = Number(req.params['tripId']);
  const trip = tripsRepo.findTripById(tripId);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    trips:          [trip],
    days:           daysRepo.findDaysByTripId(tripId),
    activities:     activitiesRepo.findActivitiesByTripId(tripId),
    reservations:   reservationsRepo.findAllByTripId(tripId),
    checklistItems: checklistRepo.findChecklistItemsByTripId(tripId),
  });
});

router.delete('/data/wipe', (req: Request, res: Response) => {
  // Reason: confirmation guard prevents accidental data loss from non-browser HTTP clients
  // (curl, scripts, LAN requests) that are not blocked by the browser CORS policy.
  if (req.query['confirm'] !== 'wipe-all-data') {
    res.status(400).json({ error: 'Pass ?confirm=wipe-all-data to confirm data wipe' });
    return;
  }
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM checklist_items').run();
    db.prepare('DELETE FROM activities').run();
    db.prepare('DELETE FROM reservations').run();
    db.prepare('DELETE FROM days').run();
    db.prepare('DELETE FROM trips').run();
  })();
  res.status(204).send();
});

// ── Trip pack import ──────────────────────────────────────────────────────────

const ImportPayloadSchema = z.object({
  version:        z.number().optional(),
  trips:          z.array(z.record(z.string(), z.unknown())),
  days:           z.array(z.record(z.string(), z.unknown())),
  activities:     z.array(z.record(z.string(), z.unknown())),
  reservations:   z.array(z.record(z.string(), z.unknown())),
  checklistItems: z.array(z.record(z.string(), z.unknown())),
});

router.post('/import/trippack', (req: Request, res: Response) => {
  const parsed = ImportPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid trippack format' });
    return;
  }
  const { trips, days, activities, reservations, checklistItems } = parsed.data;
  const db = getDb();
  const tripIdMap = new Map<number, number>();
  const dayIdMap  = new Map<number, number>();

  // Reason: validate CHECK-constrained enum columns so invalid values in the import payload
  // fall back to safe defaults rather than throwing a SqliteError inside the transaction.
  const toTripStatus   = (v: unknown): string => typeof v === 'string' && ['draft','planning','confirmed','ready','completed','archived'].includes(v) ? v : 'draft';
  const toActivityType = (v: unknown): string => typeof v === 'string' && ['attraction','food','shopping','outdoors','cultural','note','other'].includes(v) ? v : 'note';
  const toResType      = (v: unknown): string => typeof v === 'string' && ['lodging','flight','train','bus','ferry','rental_car','restaurant','other'].includes(v) ? v : 'other';
  const toResStatus    = (v: unknown): string => typeof v === 'string' && ['pending','confirmed','cancelled'].includes(v) ? v : 'pending';

  const runImport = db.transaction(() => {
    for (const t of trips) {
      // Reason: tags may be a parsed string[] (from ParsedTripRow) or already a JSON string.
      const tags = Array.isArray(t['tags']) ? JSON.stringify(t['tags']) : (t['tags'] ?? '[]');

      // Reason: if external_id is present and already exists in the DB, skip this
      // trip and all its children to prevent silent duplication on re-import.
      const externalId = (t['external_id'] as string | undefined) ?? null;
      if (externalId) {
        const existing = db
          .prepare('SELECT id FROM trips WHERE external_id = ?')
          .get(externalId) as { id: number } | undefined;
        if (existing) {
          tripIdMap.set(t['id'] as number, existing.id);
          continue; // skip re-inserting trip + children
        }
      }

      const result = db.prepare(
        `INSERT INTO trips (title, emoji, status, start_date, end_date, tags, notes, cover_gradient, external_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        t['title'] ?? '', t['emoji'] ?? '🗺️', toTripStatus(t['status']),
        t['start_date'] ?? null, t['end_date'] ?? null, tags,
        t['notes'] ?? null, t['cover_gradient'] ?? 'warm-brown',
        externalId ?? (db.prepare("SELECT lower(hex(randomblob(16))) AS v").get() as { v: string }).v,
      );
      tripIdMap.set(t['id'] as number, result.lastInsertRowid as number);
    }

    for (const d of days) {
      const newTripId = tripIdMap.get(d['trip_id'] as number);
      if (newTripId == null) continue;
      const result = db.prepare(
        `INSERT OR IGNORE INTO days (trip_id, date, title, subtitle, notes)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(newTripId, d['date'], d['title'] ?? null, d['subtitle'] ?? null, d['notes'] ?? null);
      // Reason: lastInsertRowid is 0 when INSERT OR IGNORE skips a duplicate — fall back to a SELECT.
      const newId = (result.lastInsertRowid as number) !== 0
        ? (result.lastInsertRowid as number)
        : (db.prepare('SELECT id FROM days WHERE trip_id = ? AND date = ?').get(newTripId, d['date']) as { id: number }).id;
      dayIdMap.set(d['id'] as number, newId);
    }

    for (const a of activities) {
      const newTripId = tripIdMap.get(a['trip_id'] as number);
      const newDayId  = a['day_id'] != null ? (dayIdMap.get(a['day_id'] as number) ?? null) : null;
      if (newTripId == null) continue;
      db.prepare(
        `INSERT INTO activities
           (day_id, trip_id, title, activity_type, start_time, end_time, sort_order, notes, location, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newDayId, newTripId,
        a['title'] ?? '', toActivityType(a['activity_type']),
        a['start_time'] ?? null, a['end_time'] ?? null, a['sort_order'] ?? 0,
        a['notes'] ?? null, a['location'] ?? null, a['lat'] ?? null, a['lng'] ?? null,
      );
    }

    for (const r of reservations) {
      const newTripId = tripIdMap.get(r['trip_id'] as number);
      const newDayId  = r['day_id'] != null ? (dayIdMap.get(r['day_id'] as number) ?? null) : null;
      if (newTripId == null) continue;
      // Reason: details may already be a JSON string (from DB) or a plain object (re-serialised export).
      const details = typeof r['details'] === 'string' ? r['details'] : JSON.stringify(r['details'] ?? {});
      db.prepare(
        `INSERT INTO reservations
           (trip_id, day_id, type, title, status, confirmation_ref, notes, cost_amount, cost_currency, details, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newTripId, newDayId,
        toResType(r['type']), r['title'] ?? '', toResStatus(r['status']),
        r['confirmation_ref'] ?? null, r['notes'] ?? null,
        r['cost_amount'] ?? null, r['cost_currency'] ?? 'EUR', details,
        r['sort_order'] ?? 0,
      );
    }

    for (const ci of checklistItems) {
      const newTripId = tripIdMap.get(ci['trip_id'] as number);
      if (newTripId == null) continue;
      // Reason: is_checked is stored as 0|1 in SQLite; the export may carry a boolean.
      const isChecked = typeof ci['is_checked'] === 'boolean' ? (ci['is_checked'] ? 1 : 0) : (ci['is_checked'] ?? 0);
      db.prepare(
        `INSERT INTO checklist_items (trip_id, label, category, is_checked, source, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        newTripId, ci['label'] ?? '', ci['category'] ?? 'General',
        isChecked, ci['source'] ?? 'trip', ci['sort_order'] ?? 0,
      );
    }
  });
  try {
    runImport();
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Import failed' });
    return;
  }

  res.status(204).send();
});

// ── Route legs ────────────────────────────────────────────────────────────────

router.get('/route-legs/usage', (_req: Request, res: Response) => {
  res.json(routeLegsRepo.getUsageStats());
});

router.get('/trips/:tripId/route-legs', (req: Request, res: Response) => {
  const tripId = parseInt(req.params['tripId'] as string, 10);
  if (isNaN(tripId)) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  res.json(routeLegsRepo.getByTrip(tripId));
});

router.get('/trips/:tripId/leg-modes', (req: Request, res: Response) => {
  const tripId = parseInt(req.params['tripId'] as string, 10);
  if (isNaN(tripId)) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  res.json(legModesRepo.getLegModes(tripId));
});

const SetLegModeSchema = z.object({
  from_lat:    z.number(),
  from_lng:    z.number(),
  to_lat:      z.number(),
  to_lng:      z.number(),
  travel_mode: z.enum(['car', 'pedestrian', 'bicycle']),
});

// Reason: POST rather than PATCH because this is an upsert on the primary key.
router.post('/trips/:tripId/leg-modes', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params['tripId'] as string, 10);
  if (isNaN(tripId)) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const parsed = SetLegModeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { from_lat, from_lng, to_lat, to_lng, travel_mode } = parsed.data;
  legModesRepo.setLegMode(tripId, from_lat, from_lng, to_lat, to_lng, travel_mode);

  const { tomtom_api_key: apiKey } = settingsRepo.getAllSettings();
  if (!apiKey) { res.status(422).json({ error: 'no_api_key' }); return; }

  const result = await fetchRouteLeg(
    { lat: from_lat, lng: from_lng },
    { lat: to_lat,   lng: to_lng },
    apiKey,
    travel_mode,
  );
  if (!result) { res.status(502).json({ error: 'route_fetch_failed' }); return; }

  const leg = routeLegsRepo.upsertLeg({
    trip_id:    tripId,
    from_lat, from_lng, to_lat, to_lng,
    distance_m: result.distance_m,
    duration_s: result.duration_s,
    polyline:   result.polyline,
    travel_mode,
  });

  res.json({ leg, legs: routeLegsRepo.getByTrip(tripId), modes: legModesRepo.getLegModes(tripId) });
});

router.post('/trips/:tripId/route-legs/sync', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params['tripId'] as string, 10);
  if (isNaN(tripId)) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const { tomtom_api_key: apiKey } = settingsRepo.getAllSettings();
  if (!apiKey) { res.status(422).json({ error: 'no_api_key' }); return; }

  const db = getDb();

  // Reason: union activities + reservations so every geocoded point in the day
  // is considered, regardless of type. Reservations offset by 1000 to sort after activities.
  type GeoPoint = { day_id: number; date: string; sort_order: number; lat: number; lng: number };
  const points = db.prepare(`
    SELECT a.day_id, d.date, a.sort_order, a.lat, a.lng
    FROM   activities a JOIN days d ON d.id = a.day_id
    WHERE  a.trip_id = ? AND a.lat IS NOT NULL AND a.lng IS NOT NULL
    UNION ALL
    SELECT r.day_id, d.date, r.sort_order + 1000 AS sort_order, r.lat, r.lng
    FROM   reservations r JOIN days d ON d.id = r.day_id
    WHERE  r.trip_id = ? AND r.lat IS NOT NULL AND r.lng IS NOT NULL
    ORDER  BY date, sort_order
  `).all(tripId, tripId) as GeoPoint[];

  // Group into map of date → ordered points
  const byDate = new Map<string, GeoPoint[]>();
  for (const p of points) {
    const list = byDate.get(p.date) ?? [];
    list.push(p);
    byDate.set(p.date, list);
  }

  const dates = [...byDate.keys()].sort();
  let synced = 0;

  // Reason: read per-leg mode overrides so each coord pair can have its own mode.
  // Falls back to 'car' when no override has been set for a pair.
  const storedModes = legModesRepo.getLegModes(tripId);
  const COORD_EPS = 0.00001;
  function legMode(from: GeoPoint, to: GeoPoint): 'car' | 'pedestrian' | 'bicycle' {
    const found = storedModes.find(m =>
      Math.abs(m.from_lat - from.lat) < COORD_EPS &&
      Math.abs(m.from_lng - from.lng) < COORD_EPS &&
      Math.abs(m.to_lat   - to.lat)   < COORD_EPS &&
      Math.abs(m.to_lng   - to.lng)   < COORD_EPS,
    );
    return (found?.travel_mode ?? 'car') as 'car' | 'pedestrian' | 'bicycle';
  }

  async function fetchAndUpsert(from: GeoPoint, to: GeoPoint): Promise<void> {
    const mode = legMode(from, to);
    const result = await fetchRouteLeg(
      { lat: from.lat, lng: from.lng },
      { lat: to.lat,   lng: to.lng },
      apiKey as string,
      mode,
    );
    if (!result) return;
    routeLegsRepo.upsertLeg({
      trip_id:     tripId,
      from_lat:    from.lat, from_lng: from.lng,
      to_lat:      to.lat,   to_lng:   to.lng,
      distance_m:  result.distance_m,
      duration_s:  result.duration_s,
      polyline:    result.polyline,
      travel_mode: mode,
    });
    synced++;
  }

  for (const date of dates) {
    const dayPts = byDate.get(date)!;
    // Reason: intra-day legs — route between every consecutive geocoded pair within the day
    // so single-day trips (or any day with multiple geocoded activities) get routing too.
    for (let j = 0; j < dayPts.length - 1; j++) {
      await fetchAndUpsert(dayPts[j], dayPts[j + 1]);
    }
  }

  for (let i = 0; i < dates.length - 1; i++) {
    const fromPoints = byDate.get(dates[i])!;
    const toPoints   = byDate.get(dates[i + 1])!;
    // Reason: inter-day leg — from the last geocoded point of day N to the first of day N+1.
    await fetchAndUpsert(fromPoints[fromPoints.length - 1], toPoints[0]);
  }

  // Update the trip's cached total distance
  if (synced > 0) {
    const legs = routeLegsRepo.getByTrip(tripId);
    const totalM = legs.reduce((sum, l) => sum + l.distance_m, 0);
    db.prepare(`UPDATE trips SET distance_total_m = ?, distance_synced_at = datetime('now') WHERE id = ?`)
      .run(totalM, tripId);
  }

  res.json({ synced, legs: routeLegsRepo.getByTrip(tripId) });
});
