CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  next_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS tasks_active_name_unique
  ON tasks(name)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_due_idx
  ON tasks(enabled, next_run_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS tasks_deleted_idx ON tasks(deleted_at);

CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'missed')),
  trigger TEXT NOT NULL CHECK (trigger IN ('scheduled', 'manual', 'retry', 'recovery')),
  scheduled_for TEXT,
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  result_preview TEXT,
  log_path TEXT,
  error_code TEXT,
  error_message TEXT,
  codex_thread_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  retried_from_run_id TEXT REFERENCES task_runs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS task_runs_one_active_per_task
  ON task_runs(task_id)
  WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS task_runs_task_created_idx ON task_runs(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_runs_status_idx ON task_runs(status, created_at);
CREATE INDEX IF NOT EXISTS task_runs_finished_idx ON task_runs(finished_at);

CREATE TABLE IF NOT EXISTS skill_origin_overrides (
  skill_id TEXT PRIMARY KEY,
  canonical_path TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('generated', 'installed', 'unconfirmed')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
