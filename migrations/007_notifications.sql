ALTER TABLE task_plans RENAME TO task_plans_before_notifications;

CREATE TABLE task_plans (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('todo', 'plan', 'idea')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  due_at TEXT,
  next_action TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

INSERT INTO task_plans (
  id, type, title, status, priority, due_at, next_action, notes,
  completed_at, created_at, updated_at, deleted_at
)
SELECT
  id, type, title, status, priority, due_at, next_action, notes,
  completed_at, created_at, updated_at, deleted_at
FROM task_plans_before_notifications;

DROP TABLE task_plans_before_notifications;

CREATE INDEX task_plans_focus_idx
  ON task_plans(status, type, due_at, priority) WHERE deleted_at IS NULL;
CREATE INDEX task_plans_updated_idx
  ON task_plans(updated_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX task_plans_deleted_idx ON task_plans(deleted_at DESC) WHERE deleted_at IS NOT NULL;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  source_module TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_version TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'important', 'urgent')),
  status TEXT NOT NULL CHECK (status IN ('unread', 'read', 'snoozed', 'resolved', 'ignored')),
  occurred_at TEXT NOT NULL,
  due_at TEXT,
  snoozed_until TEXT,
  resolved_at TEXT,
  ignored_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  delivery_channel TEXT NOT NULL DEFAULT 'in_app' CHECK (delivery_channel = 'in_app'),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(source_module, source_type, source_id, event_type, source_version)
);

CREATE INDEX notifications_inbox_idx
  ON notifications(status, severity, occurred_at DESC, id DESC);
CREATE INDEX notifications_source_idx
  ON notifications(source_module, source_type, source_id, event_type, updated_at DESC);
CREATE INDEX notifications_snoozed_idx
  ON notifications(status, snoozed_until) WHERE status = 'snoozed';
