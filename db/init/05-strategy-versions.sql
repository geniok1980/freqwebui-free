-- Strategy versions schema (история версий стратегий + откат)
-- Idempotent: safe to run on existing or fresh databases.

CREATE TABLE IF NOT EXISTS strategy_versions (
    id            SERIAL PRIMARY KEY,
    strategy_name VARCHAR(255) NOT NULL,
    version       INTEGER NOT NULL,
    source        TEXT NOT NULL,
    checksum      VARCHAR(64) NOT NULL,
    bot_id        VARCHAR(64),
    created_by    VARCHAR(100),
    comment       VARCHAR(500),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (strategy_name, version)
);

CREATE INDEX IF NOT EXISTS idx_strategy_versions_name ON strategy_versions(strategy_name);
CREATE INDEX IF NOT EXISTS idx_strategy_versions_bot  ON strategy_versions(bot_id);
