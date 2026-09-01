-- H6: Use case owner participant role with a 2x vote weight
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS is_use_case_owner boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN participants.is_use_case_owner IS
  'Use case owners pick the project they own, may vote for it, and their scores count twice.';
