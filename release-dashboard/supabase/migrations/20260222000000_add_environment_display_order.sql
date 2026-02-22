ALTER TABLE environments ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

UPDATE environments SET display_order = 0 WHERE slug = 'production';
UPDATE environments SET display_order = 1 WHERE slug = 'staging';
UPDATE environments SET display_order = 2 WHERE slug = 'sandbox';
