DROP TABLE IF EXISTS holidays;
CREATE TABLE holidays (
  date TEXT,
  name TEXT,
  is_leave_together INTEGER NOT NULL,
  PRIMARY KEY (date, name)
);

DROP TABLE IF EXISTS metadata;
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
