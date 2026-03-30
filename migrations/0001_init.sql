CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  recruiter_name TEXT,
  company_name TEXT,
  role_title TEXT,
  platform_name TEXT,
  note TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_event_at TEXT,
  page_open_count INTEGER NOT NULL DEFAULT 0,
  resume_view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS view_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewer_id TEXT,
  ip_hash TEXT,
  country TEXT,
  city TEXT,
  colo TEXT,
  user_agent TEXT,
  referer TEXT,
  details_json TEXT,
  FOREIGN KEY (share_link_id) REFERENCES share_links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_created_at ON share_links(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_links_last_event_at ON share_links(last_event_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_events_link_time ON view_events(share_link_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_events_time ON view_events(occurred_at DESC);
