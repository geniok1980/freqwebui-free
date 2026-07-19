// Полностью соответствует backend Pydantic-моделям

// Enums
export type UserRole = 'admin' | 'operator' | 'readonly';
export type BotEnvironment = 'docker' | 'baremetal' | 'k8s' | 'manual';
export type HealthState = 'healthy' | 'degraded' | 'unreachable' | 'unknown';
export type SourceMode = 'api' | 'sqlite' | 'mixed' | 'auto';
export type TradingMode = 'spot' | 'futures' | 'margin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  preferences: Record<string, unknown>;
}

export interface Bot {
  id: string;
  name: string;
  environment: BotEnvironment;
  host?: string;
  api_url?: string;
  api_port?: number;
  health_state: HealthState;
  source_mode: SourceMode;
  exchange?: string;
  strategy?: string;
  trading_mode?: TradingMode;
  is_dryrun: boolean;
  tags: string[];
  last_seen?: string;
  container_id?: string;
  user_data_path?: string;
}

export interface BotMetrics {
  bot_id: string;
  timestamp: string;
  equity?: number;
  profit_abs?: number;
  profit_pct?: number;
  profit_realized?: number;
  profit_unrealized?: number;
  open_positions: number;
  closed_trades: number;
  win_rate?: number;
  balance?: number;
  drawdown?: number;
  data_source: SourceMode;
}

export interface Trade {
  id: number;
  pair: string;
  is_open: boolean;
  open_date: string;
  close_date?: string;
  open_rate: number;
  close_rate?: number;
  amount: number;
  stake_amount: number;
  close_profit?: number;
  close_profit_abs?: number;
  enter_tag?: string;
  exit_reason?: string;
  leverage: number;
  is_short: boolean;
}

export interface PortfolioSummary {
  timestamp: string;
  total_bots: number;
  healthy_bots: number;
  degraded_bots: number;
  unreachable_bots: number;
  portfolio_bots: number;
  total_profit_abs: number;
  total_profit_pct: number;
  total_balance: number;
  total_open_positions: number;
  total_closed_trades: number;
  avg_win_rate?: number;
  best_performer?: string;
  worst_performer?: string;
}

export interface Alert {
  id: string;
  bot_id?: string;
  bot_name?: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T;
  error?: string;
}

export interface BotFilters {
  environment?: BotEnvironment;
  health_state?: HealthState;
  exchange?: string;
  strategy?: string;
  search?: string;
}

// ── Finance Data ──

export interface CryptoPrice {
  id: number;
  coin_id: string;
  symbol: string;
  name: string;
  price_usd: number;
  price_eur?: number;
  price_btc?: number;
  market_cap?: number;
  volume_24h?: number;
  change_24h_pct?: number;
  timestamp: string;
  source: string;
}

export interface NewsItem {
  id: number;
  title: string;
  source: string;
  url?: string;
  symbol?: string;
  category?: string;
  published_at?: string;
  sentiment_score?: number;
  timestamp: string;
}

export interface EconomicIndicator {
  id: number;
  indicator_id: string;
  name: string;
  value: number;
  date?: string;
  timestamp: string;
}

export interface BybitOrderbook {
  id: number;
  symbol: string;
  best_bid?: number;
  best_ask?: number;
  mid_price?: number;
  spread?: number;
  spread_pct?: number;
  bid_depth?: number;
  ask_depth?: number;
  imbalance?: number;
  timestamp: string;
}

// ── Discovery ──

export interface DiscoveryStatus {
  docker_enabled: boolean;
  filesystem_enabled: boolean;
  last_scan?: string;
  scan_interval_seconds: number;
  next_scan?: string;
}

export interface DiscoveryResult {
  discovered: number;
  new: number;
  updated: number;
  removed: number;
}

// ── Agent ──

export interface AgentWeights {
  regime: string;
  price_momentum_weight: number;
  volume_weight: number;
  sentiment_weight: number;
  volatility_weight?: number;
  correlation_weight?: number;
  created_at?: string;
}

export interface AgentStatus {
  enabled: boolean;
  current_regime: string;
  last_signal?: string;
  total_trades: number;
  win_rate?: number;
  total_profit?: number;
}

export interface AgentPerformance {
  date: string;
  regime: string;
  trades: number;
  wins: number;
  losses: number;
  profit_pct: number;
  profit_abs: number;
}

export interface AgentSignal {
  id: number;
  timestamp: string;
  pair: string;
  action: 'buy' | 'sell' | 'hold';
  regime: string;
  confidence: number;
  executed: boolean;
}
