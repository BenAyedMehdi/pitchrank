-- G18: Allow admin to mark a participant as excluded from score calculations
ALTER TABLE participants ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;
