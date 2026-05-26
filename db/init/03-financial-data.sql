-- Connect to financial_data database
\c financial_data;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CRYPTO DATA TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS crypto_prices (
    id SERIAL PRIMARY KEY,
    coin_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(20),
    name VARCHAR(100),
    price_usd DECIMAL(18, 8),
    price_eur DECIMAL(18, 8),
    price_btc DECIMAL(18, 8),
    market_cap BIGINT,
    volume_24h BIGINT,
    change_24h_pct DECIMAL(10, 4),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'coingecko',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crypto_prices_coin ON crypto_prices(coin_id);
CREATE INDEX IF NOT EXISTS idx_crypto_prices_time ON crypto_prices(timestamp DESC);

CREATE TABLE IF NOT EXISTS crypto_movers (
    id SERIAL PRIMARY KEY,
    category VARCHAR(20) NOT NULL CHECK (category IN ('gainers', 'losers')),
    coin_id VARCHAR(50) NOT NULL,
    symbol VARCHAR(20),
    name VARCHAR(100),
    price DECIMAL(18, 8),
    change_24h_pct DECIMAL(10, 4),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crypto_movers_time ON crypto_movers(timestamp DESC);

-- ============================================
-- STOCKS DATA TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS stocks (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    price DECIMAL(12, 4),
    change DECIMAL(12, 4),
    change_percent DECIMAL(10, 4),
    volume BIGINT,
    market_cap BIGINT,
    pe_ratio DECIMAL(10, 2),
    sector VARCHAR(50),
    industry VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_time ON stocks(timestamp DESC);

-- ============================================
-- PORTFOLIO DATA TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    id SERIAL PRIMARY KEY,
    total_trades INTEGER,
    winning_trades INTEGER,
    losing_trades INTEGER,
    win_rate DECIMAL(5, 2),
    total_profit_abs DECIMAL(18, 8),
    total_profit_pct DECIMAL(10, 4),
    avg_profit_per_trade DECIMAL(18, 8),
    profit_factor DECIMAL(10, 2),
    gross_profit DECIMAL(18, 8),
    gross_loss DECIMAL(18, 8),
    sources JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_time ON portfolio_snapshots(timestamp DESC);

CREATE TABLE IF NOT EXISTS portfolio_trades (
    id SERIAL PRIMARY KEY,
    trade_id VARCHAR(100),
    pair VARCHAR(50),
    is_short BOOLEAN,
    open_date TIMESTAMP WITH TIME ZONE,
    close_date TIMESTAMP WITH TIME ZONE,
    open_rate DECIMAL(18, 8),
    close_rate DECIMAL(18, 8),
    amount DECIMAL(18, 8),
    profit_abs DECIMAL(18, 8),
    profit_pct DECIMAL(10, 4),
    strategy VARCHAR(100),
    bot_name VARCHAR(100),
    snapshot_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_pair ON portfolio_trades(pair);
CREATE INDEX IF NOT EXISTS idx_portfolio_trades_time ON portfolio_trades(close_date DESC);

-- ============================================
-- NEWS DATA TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    source VARCHAR(100),
    url TEXT,
    symbol VARCHAR(20),
    category VARCHAR(50) CHECK (category IN ('market', 'crypto', 'stock', 'forex')),
    published_at TIMESTAMP WITH TIME ZONE,
    sentiment_score DECIMAL(5, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_news_symbol ON news(symbol);
CREATE INDEX IF NOT EXISTS idx_news_time ON news(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news(category);

CREATE TABLE IF NOT EXISTS insider_trades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    insider_name VARCHAR(100),
    relationship VARCHAR(50),
    transaction_date DATE,
    transaction_type VARCHAR(20),
    cost DECIMAL(12, 4),
    shares INTEGER,
    value DECIMAL(18, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insider_symbol ON insider_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_insider_time ON insider_trades(timestamp DESC);

-- ============================================
-- ECONOMIC DATA TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS economic_indicators (
    id SERIAL PRIMARY KEY,
    indicator_id VARCHAR(50) NOT NULL,
    name VARCHAR(100),
    value DECIMAL(18, 6),
    date DATE,
    unit VARCHAR(20),
    frequency VARCHAR(20),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE economic_indicators
    ADD CONSTRAINT economic_indicators_indicator_date_key UNIQUE (indicator_id, date);
CREATE INDEX IF NOT EXISTS idx_economic_indicator ON economic_indicators(indicator_id);
CREATE INDEX IF NOT EXISTS idx_economic_time ON economic_indicators(timestamp DESC);

CREATE TABLE IF NOT EXISTS treasury_yields (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(50),
    yield DECIMAL(10, 4),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_treasury_symbol ON treasury_yields(symbol);
CREATE INDEX IF NOT EXISTS idx_treasury_time ON treasury_yields(timestamp DESC);

-- ============================================
-- BYBIT ORDERBOOK TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS bybit_orderbook (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    best_bid DECIMAL(18, 8),
    best_ask DECIMAL(18, 8),
    mid_price DECIMAL(18, 8),
    spread DECIMAL(18, 8),
    spread_pct DECIMAL(10, 6),
    bid_depth DECIMAL(18, 2),
    ask_depth DECIMAL(18, 2),
    imbalance DECIMAL(10, 6),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bybit_symbol ON bybit_orderbook(symbol);
CREATE INDEX IF NOT EXISTS idx_bybit_time ON bybit_orderbook(timestamp DESC);

-- ============================================
-- SYNC LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('success', 'error', 'running')),
    records_processed INTEGER,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_source ON sync_log(source);
CREATE INDEX IF NOT EXISTS idx_sync_time ON sync_log(created_at DESC);

-- ============================================
-- AGENT STRATEGY TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS signal_weights (
    id SERIAL PRIMARY KEY,
    regime VARCHAR(20) NOT NULL CHECK (regime IN ('bull', 'bear', 'ranging', 'high_vol')),
    price_momentum_weight DECIMAL(3,2) DEFAULT 0.25,
    volume_weight DECIMAL(3,2) DEFAULT 0.20,
    sentiment_weight DECIMAL(3,2) DEFAULT 0.20,
    macro_weight DECIMAL(3,2) DEFAULT 0.20,
    orderbook_weight DECIMAL(3,2) DEFAULT 0.15,
    total_trades INTEGER DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 50.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(regime)
);

CREATE TABLE IF NOT EXISTS signal_performance (
    id SERIAL PRIMARY KEY,
    trade_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pair VARCHAR(20) NOT NULL,
    regime VARCHAR(20) NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('long', 'short')),
    price_signal DECIMAL(5,2),
    volume_signal DECIMAL(5,2),
    sentiment_signal DECIMAL(5,2),
    macro_signal DECIMAL(5,2),
    orderbook_signal DECIMAL(5,2),
    combined_score DECIMAL(5,2),
    confidence DECIMAL(5,2),
    outcome VARCHAR(10) CHECK (outcome IN ('win', 'loss', 'breakeven', 'open')),
    profit_pct DECIMAL(8,4),
    duration_minutes INTEGER,
    executed BOOLEAN DEFAULT FALSE,
    approved_by_user BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_signal_perf_regime ON signal_performance(regime);
CREATE INDEX IF NOT EXISTS idx_signal_perf_outcome ON signal_performance(outcome);

CREATE TABLE IF NOT EXISTS regime_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    regime VARCHAR(20) NOT NULL,
    btc_price DECIMAL(18,8),
    btc_sma50 DECIMAL(18,8),
    btc_sma200 DECIMAL(18,8),
    atr_14 DECIMAL(18,8),
    vix DECIMAL(8,2) DEFAULT NULL,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_regime_history_time ON regime_history(timestamp);

CREATE TABLE IF NOT EXISTS agent_trades (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pair VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    stake_amount DECIMAL(18,8),
    entry_price DECIMAL(18,8),
    stoploss DECIMAL(8,4),
    take_profit DECIMAL(8,4),
    status VARCHAR(20) DEFAULT 'pending',
    freqtrade_trade_id VARCHAR(50),
    closed_at TIMESTAMP,
    final_profit DECIMAL(8,4),
    signals JSONB
);
CREATE INDEX IF NOT EXISTS idx_agent_trades_pair ON agent_trades(pair, status);

CREATE TABLE IF NOT EXISTS agent_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default signal weights
INSERT INTO signal_weights (regime, price_momentum_weight, volume_weight, sentiment_weight, macro_weight, orderbook_weight)
VALUES 
    ('bull', 0.30, 0.25, 0.20, 0.15, 0.10),
    ('bear', 0.35, 0.20, 0.15, 0.15, 0.15),
    ('ranging', 0.25, 0.30, 0.20, 0.15, 0.10),
    ('high_vol', 0.20, 0.35, 0.15, 0.20, 0.10)
ON CONFLICT (regime) DO NOTHING;

-- Insert default agent config
INSERT INTO agent_config (key, value) VALUES
    ('min_confidence', '75'),
    ('min_trades_before_adjust', '20'),
    ('max_weight_per_signal', '0.50'),
    ('learning_rate', '0.05'),
    ('position_size_pct', '0.01'),
    ('max_concurrent_trades', '3'),
    ('enabled', 'false'),
    ('paper_trading', 'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- VIEWS
-- ============================================

CREATE OR REPLACE VIEW vw_agent_weights AS
SELECT 
    regime,
    price_momentum_weight,
    volume_weight,
    sentiment_weight,
    macro_weight,
    orderbook_weight,
    (price_momentum_weight + volume_weight + sentiment_weight + macro_weight + orderbook_weight) as total_weight,
    win_rate,
    total_trades,
    last_updated
FROM signal_weights
ORDER BY win_rate DESC;

CREATE OR REPLACE VIEW vw_agent_performance AS
SELECT 
    DATE_TRUNC('day', timestamp) as date,
    COUNT(*) as total_signals,
    SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
    ROUND(100.0 * SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as win_rate,
    ROUND(AVG(profit_pct), 4) as avg_profit,
    ROUND(SUM(profit_pct), 4) as total_profit
FROM signal_performance
WHERE outcome IS NOT NULL
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date DESC;

-- ============================================
-- DAILY PERFORMANCE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_performance (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    bot_name VARCHAR(100),
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    win_rate DECIMAL(5, 2),
    profit_abs DECIMAL(18, 8),
    profit_pct DECIMAL(10, 4),
    cumulative_profit DECIMAL(18, 8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date, bot_name)
);
CREATE INDEX IF NOT EXISTS idx_daily_perf_date ON daily_performance(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_perf_bot ON daily_performance(bot_name);
