-- Strategy Lab schema migration
-- Adds missing columns to support strategy_lab.py queries.
-- Idempotent: safe to run on existing or fresh databases.

-- backtest_results
ALTER TABLE backtest_results ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS profit_abs        FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS avg_profit_pct    FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS max_drawdown_abs  FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS sortino_ratio     FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS calmar_ratio      FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS start_balance     FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS final_balance     FLOAT;
ALTER TABLE backtest_results ADD COLUMN IF NOT EXISTS export_file       VARCHAR(500);

-- Migrate data from legacy column names (if they exist in this DB)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='total_profit_pct') THEN
    EXECUTE 'UPDATE backtest_results SET profit_pct = COALESCE(profit_pct, total_profit_pct)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='total_profit_abs') THEN
    EXECUTE 'UPDATE backtest_results SET profit_abs = COALESCE(profit_abs, total_profit_abs)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='win_rate') THEN
    EXECUTE 'UPDATE backtest_results SET winrate_pct = COALESCE(winrate_pct, win_rate)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='sharpe') THEN
    EXECUTE 'UPDATE backtest_results SET sharpe_ratio = COALESCE(sharpe_ratio, sharpe)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='sortino') THEN
    EXECUTE 'UPDATE backtest_results SET sortino_ratio = COALESCE(sortino_ratio, sortino)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='calmar') THEN
    EXECUTE 'UPDATE backtest_results SET calmar_ratio = COALESCE(calmar_ratio, calmar)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='backtest_results' AND column_name='backtest_date') THEN
    EXECUTE 'UPDATE backtest_results SET created_at = COALESCE(created_at, backtest_date)';
  END IF;
END $$;

-- optimization_runs
ALTER TABLE optimization_runs ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS total_trades     INTEGER;
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS sharpe_ratio     FLOAT;
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS params           JSONB;
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS config           JSONB;
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS fthypt_path      VARCHAR(500);
ALTER TABLE optimization_runs ADD COLUMN IF NOT EXISTS error_message    TEXT;

-- hyperopt_epochs
ALTER TABLE hyperopt_epochs ALTER COLUMN bot_id DROP NOT NULL;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS run_id           INTEGER REFERENCES optimization_runs(id) ON DELETE CASCADE;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS strategy_name    VARCHAR(100);
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS avg_profit_pct   FLOAT;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS total_trades     INTEGER;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS max_drawdown_pct FLOAT;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS sharpe_ratio     FLOAT;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS sortino_ratio    FLOAT;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS objective        FLOAT;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS is_best          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hyperopt_epochs ADD COLUMN IF NOT EXISTS extracted        BOOLEAN NOT NULL DEFAULT FALSE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backtest_results_strategy   ON backtest_results(strategy_name);
CREATE INDEX IF NOT EXISTS idx_hyperopt_epochs_strategy    ON hyperopt_epochs(strategy_name);
CREATE INDEX IF NOT EXISTS idx_hyperopt_epochs_best        ON hyperopt_epochs(is_best);
CREATE INDEX IF NOT EXISTS idx_opt_runs_strategy           ON optimization_runs(strategy_name);
