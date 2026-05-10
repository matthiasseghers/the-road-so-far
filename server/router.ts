import { Router, type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getDb } from '../src/db/client.js';
import { IMAGE_PROVIDERS, ALLOWED_IMAGE_HOSTS } from './providers/index.js';
import * as tripsRepo from '../src/db/repositories/trips.repo.js';
import * as daysRepo from '../src/db/repositories/days.repo.js';
import * as activitiesRepo from '../src/db/repositories/activities.repo.js';
import * as reservationsRepo from '../src/db/repositories/reservations.repo.js';
import * as checklistRepo from '../src/db/repositories/checklist.repo.js';
import * as settingsRepo from '../src/db/repositories/settings.repo.js';
import * as routeLegsRepo from '../src/db/repositories/route-legs.repo.js';
import * as legModesRepo from '../src/db/repositories/leg-modes.repo.js';
import * as mapRepo from '../src/db/repositories/map.repo.js';
import { findLegMode } from '../src/utils/routing.js';
import * as calendarRepo from '../src/db/repositories/calendar.repo.js';
import { syncDaysForTrip } from '../src/services/days.service.js';
import { geocodePlace, autocomplete } from '../src/services/geocoding.service.js';
import { fetchRouteLeg } from '../src/services/routing.service.js';
import { fetchStaticMapImage, deriveZoom } from '../src/services/maps.service.js';
import { CreateTripSchema, PatchTripSchema } from '../src/schemas/trip.schema.js';
import { CreateActivitySchema, PatchActivitySchema } from '../src/schemas/activity.schema.js';
import { CreateReservationSchema, UpdateReservationSchema } from '../src/schemas/reservation.schema.js';
import { CreateChecklistItemSchema, PatchChecklistItemSchema } from '../src/schemas/checklist.schema.js';
import { PatchDaySchema } from '../src/schemas/day.schema.js';
import { z } from 'zod';

// ── Route parameter helpers ───────────────────────────────────────────────────

// Reason: Number() silently returns NaN for non-numeric strings, which
// better-sqlite3 coerces to NULL — potentially matching unrelated rows.
// parseInt with guards produces a clean 400 instead.
// Accepts string | string[] | undefined to cover both req.params and req.query typings.
// Reason: named parseIdParam (not parseIntParam) because every integer URL param in this
// router is a SQLite AUTOINCREMENT primary key, which is always a positive integer (≥ 1).
// Zero and negatives are structurally invalid IDs — rejecting them here is correct.
function parseIdParam(val: string | string[] | undefined): number | null {
  const str = Array.isArray(val) ? val[0] : val;
  const n = parseInt(str ?? '', 10);
  return isNaN(n) || n <= 0 ? null : n;
}

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
// Reason: per-key validation so each setting is checked against its actual domain.
// The key comes from req.params (URL), not the body, so we resolve the correct
// Zod schema at runtime after the key whitelist check.
const SETTING_SCHEMAS: Record<string, z.ZodTypeAny> = {
  theme:              z.enum(['light', 'dark', 'auto']),
  date_format:        z.enum(['DD MMM YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
  time_areas:         z.record(z.string(), z.object({
    label: z.string().min(1).max(64),
    start: z.number().int().min(0).max(24),
    end:   z.number().int().min(0).max(24),
  }).refine(a => a.end > a.start, { message: 'end must be after start' })),
  tomtom_api_key:     z.string().max(256).trim(),
  geocoding_provider: z.enum(['nominatim', 'tomtom']),
  routing_provider:   z.enum(['tomtom']),
  maps_provider:      z.enum(['tomtom']),
  pexels_api_key:     z.string().max(256).trim(),
  unsplash_api_key:   z.string().max(256).trim(),
  unsplash_app_name:  z.string().max(100).trim(),
  pixabay_api_key:    z.string().max(256).trim(),
};
const SettingBodySchema     = z.object({ value: z.unknown() });
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
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const trip = tripsRepo.findTripWithDays(id);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(trip);
});

router.get('/trips/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const trip = tripsRepo.findTripById(id);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(trip);
});

router.patch('/trips/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const parsed = PatchTripSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const trip = tripsRepo.updateTrip(id, parsed.data);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  if (trip.start_date && trip.end_date) {
    syncDaysForTrip(trip.id, trip.start_date, trip.end_date);
  }
  res.json(trip);
});

router.delete('/trips/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  tripsRepo.deleteTrip(id);
  res.status(204).send();
});

// ── Calendar ──────────────────────────────────────────────────────────────────

router.get('/trips/:tripId/calendar-days', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  const trip = tripsRepo.findTripById(tripId);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }
  res.json(calendarRepo.getDaysForTrip(tripId));
});

// ── Days ──────────────────────────────────────────────────────────────────────

router.get('/days', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.query['tripId'] as string | undefined);
  if (!tripId) { res.status(400).json({ error: 'tripId query param required' }); return; }
  res.json(daysRepo.findDaysByTripId(tripId));
});

router.patch('/days/:id', (req: Request, res: Response) => {
  const parsed = PatchDaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const day = daysRepo.updateDay(id, parsed.data);
  if (!day) { res.status(404).json({ error: 'Day not found' }); return; }
  res.json(day);
});

// ── Activities ────────────────────────────────────────────────────────────────

router.get('/activities', (req: Request, res: Response) => {
  const dayId  = parseIdParam(req.query['dayId']  as string | undefined);
  const tripId = parseIdParam(req.query['tripId'] as string | undefined);
  if (dayId) {
    res.json(activitiesRepo.findActivitiesByDayId(dayId));
  } else if (tripId) {
    res.json(activitiesRepo.findActivitiesByTripId(tripId));
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
  const matched = activitiesRepo.reorderActivities(parsed.data.dayId, parsed.data.orderedIds);
  // Reason: 422 when IDs don't all belong to the specified day, preventing silent no-ops.
  if (matched !== parsed.data.orderedIds.length) {
    res.status(422).json({ error: 'Some activity IDs do not belong to the specified day' });
    return;
  }
  res.status(204).send();
});

router.patch('/activities/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const parsed = PatchActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const activity = activitiesRepo.updateActivity(id, parsed.data);
  if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }
  res.json(activity);
});

const GeocodeBodySchema = z.object({
  // Reason: 512 chars is well above any real place name; capping prevents
  // multi-MB strings from being URL-encoded and forwarded to Nominatim/TomTom.
  location: z.string().trim().min(1).max(512),
  // Reason: when the client already has coordinates from autocomplete, skip
  // the external Nominatim call and use them directly.
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

router.patch('/activities/:id/geocode', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const activity = activitiesRepo.findActivityById(id);
  if (!activity) { res.status(404).json({ error: 'Activity not found' }); return; }
  const parsed = GeocodeBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: 'Location is required for geocoding' }); return; }
  // Reason: skip geocoding round-trip when client already has coordinates from autocomplete.
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
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  if (!activitiesRepo.findActivityById(id)) { res.status(404).json({ error: 'Activity not found' }); return; }
  activitiesRepo.deleteActivity(id);
  res.status(204).send();
});

// ── Reservations ──────────────────────────────────────────────────────────

router.get('/reservations', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.query['tripId'] as string | undefined);
  const dayId  = parseIdParam(req.query['dayId']  as string | undefined);
  if (tripId) {
    res.json(reservationsRepo.findAllByTripId(tripId));
  } else if (dayId) {
    res.json(reservationsRepo.findAllByDayId(dayId));
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
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const reservation = reservationsRepo.findById(id);
  if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return; }
  res.json(reservation);
});
router.patch('/reservations/:id/geocode', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const reservation = reservationsRepo.findById(id);
  if (!reservation) { res.status(404).json({ error: 'Reservation not found' }); return; }
  const parsed = GeocodeBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(422).json({ error: 'Location is required for geocoding' }); return; }
  // Reason: skip geocoding round-trip when client already has coordinates from autocomplete.
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
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const parsed = UpdateReservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const result = reservationsRepo.updateReservationSafe(id, parsed.data);
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
  const dayId = parseIdParam(req.params['dayId']);
  if (!dayId) { res.status(400).json({ error: 'Invalid dayId' }); return; }
  const parsed = ReorderItemsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  reservationsRepo.reorderDayItems(dayId, parsed.data.items);
  // Reason: unlike reorderActivities, a mixed list (activities + reservations) may
  // partially succeed — e.g. all activity IDs valid, one reservation ID invalid.
  // We don't 422 here because partial reorders are acceptable; the frontend always
  // sends the full ordered set from its own state, so orphan IDs are benign no-ops.
  res.status(204).send();
});

router.delete('/reservations/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  if (!reservationsRepo.findById(id)) { res.status(404).json({ error: 'Reservation not found' }); return; }
  reservationsRepo.deleteReservation(id);
  res.status(204).send();
});

// ── Checklist items ───────────────────────────────────────────────────────────

// Reason: POST /checklist-items/copy-templates is kept here (rather than moving
// to /trips/:tripId/checklist/copy-templates) because it accepts a tripId in the
// body and copies multiple templates in one call — no natural parent resource.
router.post('/checklist-items/copy-templates', (req: Request, res: Response) => {
  const parsed = CopyTemplatesSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const { items, inserted, skipped } = checklistRepo.copyTemplatesToTrip(parsed.data.tripId, parsed.data.templateIds);
  res.status(201).json({ items, inserted, skipped });
});

router.put('/trips/:tripId/checklist/reorder', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  const parsed = TripReorderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const matched = checklistRepo.reorderChecklistItems(tripId, parsed.data.ids);
  if (matched !== parsed.data.ids.length) {
    res.status(422).json({ error: 'Some checklist item IDs do not belong to the specified trip' });
    return;
  }
  res.status(204).send();
});

// ── Checklist RESTful routes ─────────────────────────────────────────────────

router.get('/trips/:tripId/checklist', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  res.json(checklistRepo.findChecklistItemsByTripId(tripId));
});

router.post('/trips/:tripId/checklist', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  const parsed = CreateChecklistItemSchema.safeParse({ ...req.body, trip_id: tripId });
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const item = checklistRepo.createChecklistItem(parsed.data);
  res.status(201).json(item);
});

router.patch('/trips/:tripId/checklist/:id', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  const id = parseIdParam(req.params['id']);
  if (!tripId || !id) { res.status(400).json({ error: 'Invalid id' }); return; }
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
  const tripId = parseIdParam(req.params['tripId']);
  const id = parseIdParam(req.params['id']);
  if (!tripId || !id) { res.status(400).json({ error: 'Invalid id' }); return; }
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
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  // Reason: Express already URL-decodes path params; a second decodeURIComponent would
  // double-decode sequences like %25 → % → wrong character.
  const oldCat = req.params['cat'] as string;
  checklistRepo.renameChecklistCategory(tripId, oldCat, parsed.data.name.toLowerCase());
  res.status(204).send();
});

router.delete('/trips/:tripId/checklist/category/:cat', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  const cat = req.params['cat'] as string;
  checklistRepo.deleteChecklistItemsByCategory(tripId, cat);
  res.status(204).send();
});

// ── Checklist templates ───────────────────────────────────────────────────────

// Reason: /categories must be declared before /:id to prevent Express routing 'categories' as an id param
router.get('/checklist-templates/categories', (_req: Request, res: Response) => {
  res.json(checklistRepo.getDistinctCategories());
});

router.get('/checklist-templates/full', (_req: Request, res: Response) => {
  res.json(checklistRepo.findAllTemplatesWithItems());
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
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const template = checklistRepo.findTemplateById(id);
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(template);
});

router.patch('/checklist-templates/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const parsed = TemplatePatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const template = checklistRepo.updateTemplate(id, parsed.data);
  if (!template) { res.status(404).json({ error: 'Template not found' }); return; }
  res.json(template);
});

router.delete('/checklist-templates/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  try {
    checklistRepo.deleteTemplate(id);
    res.status(204).send();
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

router.get('/template-items', (req: Request, res: Response) => {
  const templateId = parseIdParam(req.query['templateId'] as string | undefined);
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
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const parsed = TemplateItemPatchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const item = checklistRepo.updateTemplateItem(id, parsed.data);
  if (!item) { res.status(404).json({ error: 'Template item not found' }); return; }
  res.json(item);
});

router.delete('/template-items/:id', (req: Request, res: Response) => {
  const id = parseIdParam(req.params['id']);
  if (!id) { res.status(400).json({ error: 'Invalid id' }); return; }
  const existing = checklistRepo.findTemplateItemById(id);
  if (!existing) { res.status(404).json({ error: 'Template item not found' }); return; }
  checklistRepo.deleteTemplateItem(id);
  res.status(204).send();
});

router.put('/template-items/reorder', (req: Request, res: Response) => {
  const parsed = TemplateReorderSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }
  const matched = checklistRepo.reorderTemplateItems(parsed.data.templateId, parsed.data.ids);
  if (matched !== parsed.data.ids.length) {
    res.status(422).json({ error: 'Some template item IDs do not belong to the specified template' });
    return;
  }
  res.status(204).send();
});

// ── Geocoding autocomplete proxy ─────────────────────────────────────────────

// Reason: proxying through Express keeps API keys server-side — the browser
// never sees the TomTom key, regardless of which geocoding provider is active.
router.get('/geocode/autocomplete', (req: Request, res: Response) => {
  const q = (req.query['q'] as string | undefined)?.trim() ?? '';
  if (q.length < 2) { res.json({ suggestions: [] }); return; }
  autocomplete(q)
    .then(suggestions => res.json({ suggestions }))
    .catch(() => res.json({ suggestions: [] }));
});

// ── Global map ───────────────────────────────────────────────────────────────

// Reason: returns all geocoded activities + reservations across all trips in one
// flat list so the global MapPage can render without per-trip fetch loops.
router.get('/map/pins', (_req: Request, res: Response) => {
  res.json(mapRepo.getMapPins());
});

// ── Settings ─────────────────────────────────────────────────────────────────

router.get('/settings', (_req: Request, res: Response) => {
  const settings = settingsRepo.getAllSettings();
  // Reason: the raw TomTom API key must not be returned to the browser in the
  // general settings payload — components that only need to know whether a key
  // is configured should use `has_tomtom_api_key`. Only the Settings panel calls
  // GET /settings/tomtom_api_key to load the key for display/editing purposes.
  res.json({
    ...settings,
    tomtom_api_key:     '',
    has_tomtom_api_key: settings.tomtom_api_key.length > 0,
  });
});

// Reason: dedicated route so the Settings panel can pre-fill the API key input.
// Separated from GET /settings so other consumers never receive the raw key.
// Must be declared before PUT /settings/:key to avoid being caught as a param match.
router.get('/settings/tomtom_api_key', (_req: Request, res: Response) => {
  const { tomtom_api_key } = settingsRepo.getAllSettings();
  res.json({ tomtom_api_key });
});

// Dedicated read routes for image provider API keys (never returned in GET /settings).
router.get('/settings/pexels_api_key', (_req: Request, res: Response) => {
  res.json({ pexels_api_key: settingsRepo.getSetting<string>('pexels_api_key') ?? '' });
});
router.get('/settings/unsplash_api_key', (_req: Request, res: Response) => {
  res.json({ unsplash_api_key: settingsRepo.getSetting<string>('unsplash_api_key') ?? '' });
});
router.get('/settings/unsplash_app_name', (_req: Request, res: Response) => {
  res.json({ unsplash_app_name: settingsRepo.getSetting<string>('unsplash_app_name') ?? '' });
});
router.get('/settings/pixabay_api_key', (_req: Request, res: Response) => {
  res.json({ pixabay_api_key: settingsRepo.getSetting<string>('pixabay_api_key') ?? '' });
});

// Reason: whitelist prevents arbitrary keys from being written to the settings table
// by non-browser HTTP clients that bypass the frontend's fixed set of setting keys.
const ALLOWED_SETTING_KEYS = ['theme', 'date_format', 'time_areas', 'tomtom_api_key', 'geocoding_provider', 'routing_provider', 'maps_provider', 'pexels_api_key', 'unsplash_api_key', 'unsplash_app_name', 'pixabay_api_key'] as const;
type AllowedSettingKey = typeof ALLOWED_SETTING_KEYS[number];

router.put('/settings/:key', (req: Request, res: Response) => {
  const bodyParsed = SettingBodySchema.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ errors: bodyParsed.error.flatten().fieldErrors }); return; }
  // Reason: Express params are always string at runtime; bracket access types as string | string[] in some @types/express versions
  const key = req.params['key'] as string;
  if (!ALLOWED_SETTING_KEYS.includes(key as AllowedSettingKey)) {
    res.status(400).json({ error: `Unknown setting key: ${key}` });
    return;
  }
  // Reason: validate the value against the key-specific schema so each setting
  // is constrained to its actual domain, not just z.unknown().
  const valueSchema = SETTING_SCHEMAS[key];
  if (!valueSchema) { res.status(400).json({ error: `Unknown setting key: ${key}` }); return; }
  const valueParsed = valueSchema.safeParse(bodyParsed.data.value);
  if (!valueParsed.success) { res.status(400).json({ errors: valueParsed.error.flatten().fieldErrors ?? valueParsed.error.issues }); return; }
  settingsRepo.setSetting(key, valueParsed.data);
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
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
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
  // Reason: do NOT reveal the expected confirmation string in the error message —
  // doing so turns the 400 response into a self-documenting LAN wipe script primer.
  if (req.query['confirm'] !== 'wipe-all-data') {
    res.status(400).json({ error: 'Missing or invalid confirmation parameter' });
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
  // Reason: import payloads may carry non-numeric values (e.g. "abc" for sort_order)
  // where SQLite expects integers/reals. Coerce to number or fall back to a safe default.
  const toInt          = (v: unknown, fallback = 0): number => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; };
  const toFloat        = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const toStr          = (v: unknown): string | null => typeof v === 'string' ? v : null;

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
        toStr(a['start_time']), toStr(a['end_time']), toInt(a['sort_order']),
        toStr(a['notes']), toStr(a['location']), toFloat(a['lat']), toFloat(a['lng']),
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
        toStr(r['confirmation_ref']), toStr(r['notes']),
        toFloat(r['cost_amount']), typeof r['cost_currency'] === 'string' ? r['cost_currency'] : 'EUR', details,
        toInt(r['sort_order']),
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
        isChecked, ci['source'] ?? 'trip', toInt(ci['sort_order']),
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

router.get('/trips/:tripId/route-legs', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const legs         = routeLegsRepo.getByTrip(tripId);
  const expectedLegs = routeLegsRepo.computeExpectedLegs(tripId);

  // Reason: a trip is stale when the expected leg set differs from what's stored.
  // Compares on (from, to) coords only — travel_mode changes are handled by setLegMode.
  const storedKeys   = new Set(legs.map(l => `${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng}`));
  const expectedKeys = new Set(expectedLegs.map(l => `${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng}`));
  const isStale = legs.some(l => !expectedKeys.has(`${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng}`))
               || expectedLegs.some(l => !storedKeys.has(`${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng}`));

  res.json({ legs, expectedLegs, isStale });
});

router.get('/trips/:tripId/leg-modes', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }
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
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const parsed = SetLegModeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ errors: parsed.error.flatten().fieldErrors }); return; }

  const { from_lat, from_lng, to_lat, to_lng, travel_mode } = parsed.data;
  legModesRepo.setLegMode(tripId, from_lat, from_lng, to_lat, to_lng, travel_mode);

  const { tomtom_api_key: apiKey } = settingsRepo.getAllSettings();
  if (!apiKey) { res.status(422).json({ error: 'no_api_key' }); return; }

  let result: Awaited<ReturnType<typeof fetchRouteLeg>>;
  try {
    result = await fetchRouteLeg(
      { lat: from_lat, lng: from_lng },
      { lat: to_lat,   lng: to_lng },
      apiKey,
      travel_mode,
    );
  } catch {
    res.status(502).json({ error: 'route_fetch_failed' });
    return;
  }
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
  const tripIdRaw = parseIdParam(req.params['tripId']);
  if (!tripIdRaw) { res.status(400).json({ error: 'Invalid tripId' }); return; }
  const tripId: number = tripIdRaw;

  const { tomtom_api_key: apiKey } = settingsRepo.getAllSettings();
  if (!apiKey) { res.status(422).json({ error: 'no_api_key' }); return; }

  const db = getDb();

  // Reason: compute the ground-truth expected leg set from current geo points,
  // then delete any stored legs that are no longer expected (orphans from
  // removed/reordered activities), and only call TomTom for legs not yet cached.
  const expectedLegs = routeLegsRepo.computeExpectedLegs(tripId);
  const deleted = routeLegsRepo.deleteOrphanLegs(tripId, expectedLegs);

  // Build a set of already-cached leg keys so we skip TomTom calls for them.
  const cachedLegs = routeLegsRepo.getByTrip(tripId);
  const storedModes = legModesRepo.getLegModes(tripId);
  const cachedKeys = new Set(
    cachedLegs.map(l => `${l.from_lat},${l.from_lng},${l.to_lat},${l.to_lng},${l.travel_mode}`),
  );

  let synced = 0;

  for (const expected of expectedLegs) {
    const mode = findLegMode(storedModes, expected.from_lat, expected.from_lng, expected.to_lat, expected.to_lng, 'car');
    const cacheKey = `${expected.from_lat},${expected.from_lng},${expected.to_lat},${expected.to_lng},${mode}`;

    // Reason: leg already cached with the right travel mode — skip TomTom call.
    if (cachedKeys.has(cacheKey)) continue;

    let result: Awaited<ReturnType<typeof fetchRouteLeg>>;
    try {
      result = await fetchRouteLeg(
        { lat: expected.from_lat, lng: expected.from_lng },
        { lat: expected.to_lat,   lng: expected.to_lng },
        apiKey,
        mode,
      );
    } catch {
      continue;
    }
    if (!result) continue;
    routeLegsRepo.upsertLeg({
      trip_id:     tripId,
      from_lat:    expected.from_lat, from_lng: expected.from_lng,
      to_lat:      expected.to_lat,   to_lng:   expected.to_lng,
      distance_m:  result.distance_m,
      duration_s:  result.duration_s,
      polyline:    result.polyline,
      travel_mode: mode,
    });
    synced++;
  }

  const finalLegs = routeLegsRepo.getByTrip(tripId);

  if (synced > 0 || deleted > 0) {
    const totalM = finalLegs.reduce((sum, l) => sum + l.distance_m, 0);
    db.prepare(`UPDATE trips SET distance_total_m = ?, distance_synced_at = datetime('now') WHERE id = ?`)
      .run(totalM, tripId);
  }

  res.json({ synced, deleted, legs: finalLegs });
});

// ── Static map image for PDF export ──────────────────────────────────────────

// Returns the number of geocoded points in the trip — used by the export modal
// to show a warning when some activities/reservations have no location.
router.get('/trips/:tripId/geo-point-counts', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const activities   = activitiesRepo.findActivitiesByTripId(tripId);
  const reservations = reservationsRepo.findAllByTripId(tripId);

  const totalActivities   = activities.length;
  const geocodedActivities = activities.filter(a => a.lat !== null && a.lng !== null).length;
  const totalReservations  = reservations.length;
  const geocodedReservations = reservations.filter(r => r.lat !== null && r.lng !== null).length;

  res.json({
    activities:          totalActivities,
    geocodedActivities,
    reservations:        totalReservations,
    geocodedReservations,
    totalPoints:         totalActivities + totalReservations,
    geocodedPoints:      geocodedActivities + geocodedReservations,
  });
});
router.get('/trips/:tripId/static-map-image', async (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const { tomtom_api_key: apiKey } = settingsRepo.getAllSettings();
  if (!apiKey) { res.json({ dataUrl: null, mapParams: null }); return; }

  // Optional: filter to a single day's points; default to all trip points.
  // Reason: use parseIdParam (not Number()) so non-numeric values produce null
  // rather than NaN, which would silently filter to an empty set.
  const dayId = parseIdParam(req.query['dayId'] as string | undefined);

  // Optional: image dimensions — caller can request a size matching the display target.
  // Reason: Number("foo") = NaN, and Math.min/max propagate NaN, causing "NaN" to be sent
  // to the TomTom API. Fall back to safe defaults for any non-numeric or out-of-range value.
  const parsePixels = (raw: unknown, fallback: number, lo: number, hi: number): number => {
    const n = Number(raw);
    return isNaN(n) ? fallback : Math.min(hi, Math.max(lo, n));
  };
  const imgW = parsePixels(req.query['w'], 800, 100, 800);
  const imgH = parsePixels(req.query['h'], 320, 100, 600);

  const allActivities   = activitiesRepo.findActivitiesByTripId(tripId);
  const allReservations = reservationsRepo.findAllByTripId(tripId);

  // Reason: when filtering by day, include only that day's activities + non-lodging
  // reservations. Lodging reservations span multiple days and don't meaningfully
  // represent a single day's map.
  const acts = (dayId != null ? allActivities.filter(a => a.day_id === dayId) : allActivities)
    .filter(a => a.lat !== null && a.lng !== null)
    .map(a => ({ lat: a.lat as number, lng: a.lng as number }));
  const res_ = (dayId != null
    ? allReservations.filter(r => r.day_id === dayId && r.type !== 'lodging')
    : allReservations)
    .filter(r => r.lat !== null && r.lng !== null)
    .map(r => ({ lat: r.lat as number, lng: r.lng as number }));

  const geoPoints = [...acts, ...res_];
  if (geoPoints.length < 1) { res.json({ dataUrl: null, mapParams: null }); return; }

  const lats = geoPoints.map(p => p.lat);
  const lngs = geoPoints.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Reason: pad the bounding box by 20% so no pins sit on the very edge.
  // Use a minimum span of 0.05° (~5 km) so a single-point trip still gets a useful zoom.
  const latSpan = Math.max(maxLat - minLat, 0.05);
  const lngSpan = Math.max(maxLng - minLng, 0.05);
  const latPad = latSpan * 0.2;
  const lngPad = lngSpan * 0.2;
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const latSpanPadded = latSpan + 2 * latPad;
  const lngSpanPadded = lngSpan + 2 * lngPad;

  // Reason: derive zoom via the maps service so all pins fit within the image.
  const zoom = deriveZoom(latSpanPadded, lngSpanPadded, imgW, imgH);

  const result = await fetchStaticMapImage(
    { centerLat, centerLng, zoom, imgW, imgH },
    apiKey,
  );
  if (!result) { res.json({ dataUrl: null, mapParams: null }); return; }

  // Reason: return mapParams alongside the image so the client can overlay
  // precisely-projected SVG pins using Mercator math without a second request.
  res.json({ dataUrl: result.dataUrl, mapParams: { centerLat, centerLng, zoom, imgW, imgH } });
});

// ── Cover photo routes ────────────────────────────────────────────────────────

const coversDir = path.join(process.cwd(), 'covers');

// Returns the list of providers that have an API key configured.
router.get('/covers/providers', (_req: Request, res: Response) => {
  const configured = IMAGE_PROVIDERS
    .filter(p => {
      const key = settingsRepo.getSetting<string>(`${p.id}_api_key`) ?? '';
      return key.length > 0;
    })
    .map(p => ({ id: p.id, label: p.label }));
  res.json({ providers: configured });
});

const CoverSearchSchema = z.object({
  query:    z.string().trim().min(1).max(512),
  provider: z.string().trim().min(1),
  page:     z.number().int().positive().optional().default(1),
});

router.post('/covers/search', async (req: Request, res: Response) => {
  const parsed = CoverSearchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { query, provider: providerId, page } = parsed.data;

  const provider = IMAGE_PROVIDERS.find(p => p.id === providerId);
  if (!provider) { res.status(400).json({ error: 'Unknown provider' }); return; }

  const apiKey = settingsRepo.getSetting<string>(`${providerId}_api_key`) ?? '';
  if (!apiKey) { res.status(422).json({ error: 'Provider not configured — add an API key in Settings' }); return; }

  const extra: Record<string, string> = {};
  if (providerId === 'unsplash') {
    extra['appName'] = settingsRepo.getSetting<string>('unsplash_app_name') ?? 'The Road So Far';
  }

  try {
    const result = await provider.search(query, page, apiKey, extra);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Search failed' });
  }
});

const CoverDownloadSchema = z.object({
  tripId:      z.number().int().positive(),
  fullUrl:     z.string().url(),
  provider:    z.string().trim().min(1),
  attribution: z.string().max(500),
});

router.post('/covers/download', async (req: Request, res: Response) => {
  const parsed = CoverDownloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.flatten().fieldErrors });
    return;
  }
  const { tripId, fullUrl, provider: providerId, attribution } = parsed.data;

  // Validate the download URL is from an allowed host (SSRF prevention).
  let urlHostname: string;
  try { urlHostname = new URL(fullUrl).hostname; } catch { res.status(400).json({ error: 'Invalid URL' }); return; }
  const allowed = ALLOWED_IMAGE_HOSTS[providerId];
  if (!allowed || !allowed.includes(urlHostname)) {
    res.status(400).json({ error: 'URL host not allowed for this provider' });
    return;
  }

  const trip = tripsRepo.findTripById(tripId);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }

  // Remove previous cover file if any.
  if (trip.cover_image_path) {
    // Reason: validate stored path is a bare filename (no directory separators)
    // before joining to prevent path traversal on read-back.
    const safeName = path.basename(trip.cover_image_path);
    const oldPath = path.join(coversDir, safeName);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  // Download image.
  let imgBuffer: Buffer;
  let ext = '.jpg';
  try {
    const imgRes = await fetch(fullUrl, { redirect: 'error' });
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const ct = imgRes.headers.get('content-type') ?? '';
    if (ct.includes('png')) ext = '.png';
    else if (ct.includes('webp')) ext = '.webp';
    imgBuffer = Buffer.from(await imgRes.arrayBuffer());
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Download failed' });
    return;
  }

  // Save to disk with a randomised filename to avoid collisions / enumeration.
  const randRow  = getDb().prepare("SELECT lower(hex(randomblob(8))) AS v").get() as { v: string };
  const filename = `${tripId}-${randRow.v}${ext}`;
  const destPath = path.join(coversDir, filename);
  fs.writeFileSync(destPath, imgBuffer);

  tripsRepo.updateCover(tripId, 'photo', filename, attribution);

  res.json({ filename, attribution });
});

// Returns the cover image for a trip as a base64 data URL (used by PDF export).
// Reason: validate filename strictly to prevent directory traversal.
router.get('/covers/:filename/base64', (req: Request, res: Response) => {
  const raw = req.params['filename'] as string;
  // Allow only: alphanumeric, hyphens, dots. No path separators or spaces.
  if (!/^[A-Za-z0-9\-_.]+$/.test(raw)) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }
  const filePath = path.join(coversDir, raw);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(raw).slice(1);
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  res.json({ dataUrl: `data:${mime};base64,${buf.toString('base64')}` });
});

// Deletes the cover photo file for a trip and resets cover_type to 'gradient'.
router.delete('/covers/:tripId', (req: Request, res: Response) => {
  const tripId = parseIdParam(req.params['tripId']);
  if (!tripId) { res.status(400).json({ error: 'Invalid tripId' }); return; }

  const trip = tripsRepo.findTripById(tripId);
  if (!trip) { res.status(404).json({ error: 'Trip not found' }); return; }

  if (trip.cover_image_path) {
    const safeName = path.basename(trip.cover_image_path);
    const filePath = path.join(coversDir, safeName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  tripsRepo.updateCover(tripId, 'gradient', null, null);
  res.status(204).send();
});
