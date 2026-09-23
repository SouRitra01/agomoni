-- D1 schema for Agomoni. Run once:  npx wrangler d1 execute agomoni-db --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS reports (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  city      TEXT    NOT NULL,
  pandal_id TEXT    NOT NULL,
  level     INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  ts        INTEGER NOT NULL,          -- unix seconds
  device    TEXT    NOT NULL           -- salted daily hash, never the raw IP
);
CREATE INDEX IF NOT EXISTS idx_reports_city_ts ON reports (city, ts);
CREATE INDEX IF NOT EXISTS idx_reports_device_ts ON reports (device, ts);

CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  type    TEXT    NOT NULL,
  city    TEXT    NOT NULL,
  payload TEXT    NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events (type, ts);
