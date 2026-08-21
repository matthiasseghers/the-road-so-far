-- Phase: trip cover photos
-- Add three columns to trips: cover_type (gradient|photo), cover_image_path, cover_image_attribution.
-- All existing rows receive the defaults; no data migration needed.
ALTER TABLE trips ADD COLUMN cover_type TEXT NOT NULL DEFAULT 'gradient'
  CHECK (cover_type IN ('gradient', 'photo'));
ALTER TABLE trips ADD COLUMN cover_image_path TEXT;
ALTER TABLE trips ADD COLUMN cover_image_attribution TEXT;
