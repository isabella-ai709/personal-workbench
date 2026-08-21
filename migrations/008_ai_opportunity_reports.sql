CREATE TABLE ai_opportunity_reports (
  report_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  failed_sources INTEGER NOT NULL CHECK (failed_sources >= 0),
  duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0),
  opportunity_count INTEGER NOT NULL CHECK (opportunity_count >= 0),
  payload_json TEXT NOT NULL
);

CREATE INDEX idx_ai_opportunity_reports_period
ON ai_opportunity_reports(year DESC, week DESC, imported_at DESC);
