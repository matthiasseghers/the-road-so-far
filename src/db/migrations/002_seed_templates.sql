-- Default checklist templates seeded on first run.
-- Guarded with INSERT OR IGNORE so re-running migrations is safe.

INSERT OR IGNORE INTO checklist_templates (id, name, icon_name, is_base, sort_order)
VALUES
  (1, 'Always Packed',  'Star',        1, 0),
  (2, 'Tech Kit',       'Smartphone',  0, 1),
  (3, 'Beach / Warm',   'Sun',         0, 2),
  (4, 'Cold Weather',   'Mountain',    0, 3);

INSERT OR IGNORE INTO template_items (template_id, label, category, sort_order) VALUES
  -- Always Packed
  (1, 'Passport / ID',        'documents', 0),
  (1, 'Travel insurance',     'documents', 1),
  (1, 'Phone + charger',      'tech',      2),
  (1, 'Wallet + cards',       'documents', 3),
  (1, 'Medication',           'health',    4),
  (1, 'Travel adapter',       'tech',      5),
  -- Tech Kit
  (2, 'Laptop + charger',     'tech', 0),
  (2, 'USB-C hub',            'tech', 1),
  (2, 'Power bank',           'tech', 2),
  (2, 'Camera + memory card', 'tech', 3),
  -- Beach / Warm
  (3, 'Sunscreen SPF50+',     'toiletries', 0),
  (3, 'Swimwear',             'clothing',   1),
  (3, 'Flip flops',           'clothing',   2),
  (3, 'Beach towel',          'other',      3),
  (3, 'Sunglasses',           'clothing',   4),
  -- Cold Weather
  (4, 'Thermal base layers',  'clothing', 0),
  (4, 'Warm jacket',          'clothing', 1),
  (4, 'Gloves + scarf',       'clothing', 2),
  (4, 'Wool socks',           'clothing', 3),
  (4, 'Boots',                'clothing', 4);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme',         '"dark"'),
  ('distance_unit', '"km"'),
  ('date_format',   '"DD MMM YYYY"'),
  ('time_areas',    '{"morning":{"label":"Morning","start":6,"end":12},"noon":{"label":"Noon","start":12,"end":13},"afternoon":{"label":"Afternoon","start":13,"end":17},"evening":{"label":"Evening","start":17,"end":20},"night":{"label":"Night","start":20,"end":24},"anytime":{"label":"Anytime","start":0,"end":24}}'),
  ('tomtom_api_key','""');
