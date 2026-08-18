DROP TABLE IF EXISTS task_runs;
DROP TABLE IF EXISTS tasks;

CREATE TABLE task_plans (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('todo', 'plan', 'idea')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  due_at TEXT,
  next_action TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX task_plans_focus_idx
  ON task_plans(status, type, due_at, priority) WHERE deleted_at IS NULL;
CREATE INDEX task_plans_updated_idx
  ON task_plans(updated_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX task_plans_deleted_idx ON task_plans(deleted_at DESC) WHERE deleted_at IS NOT NULL;

