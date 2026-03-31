CREATE TABLE IF NOT EXISTS view_events_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_link_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  viewer_id TEXT,
  ip_address TEXT,
  country TEXT,
  city TEXT,
  colo TEXT,
  user_agent TEXT,
  referer TEXT,
  details_json TEXT,
  FOREIGN KEY (share_link_id) REFERENCES share_links(id) ON DELETE CASCADE
);

INSERT INTO view_events_v2 (
  id,
  share_link_id,
  event_type,
  occurred_at,
  viewer_id,
  ip_address,
  country,
  city,
  colo,
  user_agent,
  referer,
  details_json
)
SELECT
  id,
  share_link_id,
  event_type,
  occurred_at,
  viewer_id,
  NULL,
  country,
  city,
  colo,
  user_agent,
  referer,
  details_json
FROM view_events;

DROP TABLE view_events;
ALTER TABLE view_events_v2 RENAME TO view_events;

CREATE INDEX IF NOT EXISTS idx_view_events_link_time ON view_events(share_link_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_events_time ON view_events(occurred_at DESC);
