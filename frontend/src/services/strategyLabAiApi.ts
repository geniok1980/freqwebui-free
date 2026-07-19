import { API_BASE_URL, getTenantSlug } from './api';
import type { OptimizationRun } from './strategyLabApi';

export interface RunAnalysisResult {
  analysis: string;
  source: string;
  model?: string | null;
  warnings: string[];
  generated_at: string;
  run: OptimizationRun & {
    timeframe?: string;
    timerange?: string;
    win_rate?: number;
    sharpe?: number;
    error_message?: string;
  };
}

export interface StrategyAnalysisResult {
  analysis: string;
  source: string;
  model?: string | null;
  warnings: string[];
  generated_at: string;
  strategy: {
    name: string;
    family?: string;
    version?: string;
    file_path?: string;
    file_preview?: string;
  };
}

export interface HyperoptRecommendationResult {
  analysis: string;
  source: string;
  model?: string | null;
  warnings: string[];
  generated_at: string;
  strategy_name: string;
  epochs: Array<{
    epoch: number;
    profit_total_pct?: number;
    max_drawdown?: number;
    trade_count?: number;
    win_rate?: number;
    params: Record<string, unknown>;
    loss?: number;
    created_at?: string;
  }>;
}

async function apiPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Unauthorized');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-Slug': getTenantSlug(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || data?.error || `HTTP ${response.status}`);
  }

  return (data?.data || data) as T;
}

export const strategyLabAiApi = {
  analyzeRun(runId: string): Promise<RunAnalysisResult> {
    return apiPost<RunAnalysisResult>('/strategy-lab/ai/run-analysis', { run_id: runId });
  },

  analyzeStrategy(strategyName: string): Promise<StrategyAnalysisResult> {
    return apiPost<StrategyAnalysisResult>('/strategy-lab/ai/strategy-analysis', {
      strategy_name: strategyName,
    });
  },

  getHyperoptRecommendations(strategyName: string): Promise<HyperoptRecommendationResult> {
    return apiPost<HyperoptRecommendationResult>('/strategy-lab/ai/hyperopt-recommendations', {
      strategy_name: strategyName,
    });
  },
};
