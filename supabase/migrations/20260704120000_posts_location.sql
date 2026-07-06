-- Optional free-text location tag on share posts (e.g. "Mission District, SF").
ALTER TABLE posts ADD COLUMN IF NOT EXISTS location text;
