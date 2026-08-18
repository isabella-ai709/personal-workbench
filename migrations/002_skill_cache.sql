CREATE TABLE IF NOT EXISTS skill_cache (
  skill_id TEXT PRIMARY KEY,
  metadata_json TEXT NOT NULL,
  refreshed_at TEXT NOT NULL
);
