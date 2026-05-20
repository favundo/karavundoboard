CREATE TABLE IF NOT EXISTS planning_tsi (
  id          TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
