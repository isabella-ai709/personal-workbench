CREATE TABLE IF NOT EXISTS retrospectives (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  review TEXT NOT NULL DEFAULT '',
  did_well TEXT NOT NULL DEFAULT '',
  did_wrong TEXT NOT NULL DEFAULT '',
  lesson TEXT NOT NULL DEFAULT '',
  next_improvement TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS retrospectives_created_idx
  ON retrospectives(created_at DESC, id DESC) WHERE deleted_at IS NULL;
