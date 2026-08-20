CREATE TABLE ai_news_reports (
  report_id TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  title TEXT NOT NULL,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  article_count INTEGER NOT NULL CHECK (article_count >= 0),
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  duration_seconds REAL NOT NULL CHECK (duration_seconds >= 0),
  failed_sources INTEGER NOT NULL CHECK (failed_sources >= 0),
  payload_json TEXT NOT NULL
);

CREATE INDEX idx_ai_news_reports_period
ON ai_news_reports(year DESC, week DESC, imported_at DESC);

