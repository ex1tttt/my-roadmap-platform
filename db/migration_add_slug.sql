-- Add slug column to cards table
ALTER TABLE cards ADD COLUMN slug TEXT UNIQUE;

-- Create index for slug for faster lookups
CREATE INDEX idx_cards_slug ON cards(slug);

-- Comment for clarity
COMMENT ON COLUMN cards.slug IS 'URL-friendly slug for beautiful card links';
