CREATE TABLE IF NOT EXISTS business_companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  relationship_status TEXT NOT NULL CHECK (relationship_status IN ('lead', 'contacted', 'active', 'former', 'paused')),
  owner TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_contact_at TEXT,
  next_follow_up_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS business_companies_active_name_unique
  ON business_companies(name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS business_companies_search_idx
  ON business_companies(relationship_status, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS business_contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES business_companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  wechat TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  decision_role TEXT NOT NULL CHECK (decision_role IN ('decision_maker', 'influencer', 'user', 'executor', 'unknown')),
  relationship_level INTEGER NOT NULL DEFAULT 1 CHECK (relationship_level BETWEEN 1 AND 5),
  preferences TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  last_contact_at TEXT,
  next_follow_up_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS business_contacts_company_idx
  ON business_contacts(company_id, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS business_opportunities (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES business_companies(id) ON DELETE SET NULL,
  primary_contact_id TEXT REFERENCES business_contacts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('lead', 'contacted', 'needs_confirmed', 'proposal', 'negotiation', 'won', 'lost')),
  needs TEXT NOT NULL DEFAULT '',
  offering TEXT NOT NULL DEFAULT '',
  amount_minor INTEGER CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  probability INTEGER NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_at TEXT,
  source TEXT NOT NULL DEFAULT '',
  competition TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  result_summary TEXT NOT NULL DEFAULT '',
  loss_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS business_opportunities_stage_idx
  ON business_opportunities(stage, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS business_partnerships (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES business_companies(id) ON DELETE SET NULL,
  primary_contact_id TEXT REFERENCES business_contacts(id) ON DELETE SET NULL,
  linked_opportunity_id TEXT REFERENCES business_opportunities(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('idea', 'contacting', 'proposal_confirmed', 'executing', 'completed', 'terminated', 'paused')),
  objective TEXT NOT NULL DEFAULT '',
  proposal_summary TEXT NOT NULL DEFAULT '',
  contributions TEXT NOT NULL DEFAULT '',
  expected_outcome TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  start_at TEXT,
  target_end_at TEXT,
  result_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS business_partnerships_status_idx
  ON business_partnerships(status, updated_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS business_activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('call', 'visit', 'meeting', 'wechat', 'email', 'note')),
  occurred_at TEXT NOT NULL,
  participants TEXT NOT NULL DEFAULT '',
  raw_content TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'ai_confirmed', 'external')),
  company_id TEXT REFERENCES business_companies(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES business_contacts(id) ON DELETE SET NULL,
  opportunity_id TEXT REFERENCES business_opportunities(id) ON DELETE SET NULL,
  partnership_id TEXT REFERENCES business_partnerships(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL OR opportunity_id IS NOT NULL OR partnership_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS business_activities_timeline_idx
  ON business_activities(occurred_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS business_follow_ups (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_at TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
  owner TEXT NOT NULL DEFAULT '',
  source_activity_id TEXT REFERENCES business_activities(id) ON DELETE SET NULL,
  company_id TEXT REFERENCES business_companies(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES business_contacts(id) ON DELETE SET NULL,
  opportunity_id TEXT REFERENCES business_opportunities(id) ON DELETE SET NULL,
  partnership_id TEXT REFERENCES business_partnerships(id) ON DELETE SET NULL,
  completed_at TEXT,
  completion_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS business_follow_ups_due_idx
  ON business_follow_ups(status, due_at, priority);

CREATE TABLE IF NOT EXISTS business_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS business_events_entity_idx
  ON business_events(entity_type, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_ai_drafts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed')),
  raw_content TEXT NOT NULL,
  result_json TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  confirmed_at TEXT
);
