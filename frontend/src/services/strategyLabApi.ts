/**
 * Strategy Lab API Service - V6
 * Connects frontend to Strategy Lab backend endpoints
 */

// Get API base URL from env or default
const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

// Helper to make authenticated requests
async function apiGet(endpoint: string) {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function apiPost(endpoint: string, data?: any) {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    },
    body: data ? JSON.stringify(data) : undefined
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// === Types ===

export interface Strategy {
  name: string;
  family?: string;
  version?: string;
  description?: string;
  file_path?: string;
  entry_type?: string;
  exit_type?: string;
  has_custom_exit?: boolean;
  has_trailing_stop?: boolean;
  indicators?: string[];
  optimizable_params?: string[];
  ml_features?: string[];
}

export interface Bot {
  id: string;
  name: string;
  strategy_name: string;
  exchange: string;
  status: string;
}

export interface WorkflowStatus {
  status: 'idle' | 'running' | 'completed' | 'error' | 'stopped';
  current_step?: string;
  progress?: number;
  started_at?: string;
  completed_at?: string;
  output?: string[];
  error?: string;
}

export interface HyperoptEpoch {
  epoch: number;
  profit_total_pct?: number;
  max_drawdown?: number;
  trade_count?: number;
  win_rate?: number;
  params: Record<string, any>;
  loss?: number;
  created_at?: string;
}

export interface OptimizationRun {
  id: string;
  strategy_name: string;
  process_type: 'backtest' | 'hyperopt' | 'download_data';
  status: 'running' | 'completed' | 'error' | 'stopped';
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  result_profit_pct?: number;
  result_drawdown?: number;
  result_trade_count?: number;
  config?: Record<string, any>;
}

// === API Methods ===

export const strategyLabApi = {
  /**
   * Get all available strategies
   */
  async getStrategies(): Promise<Strategy[]> {
    try {
      return await apiGet('/strategy-lab/strategies');
    } catch (error) {
      console.error('Failed to fetch strategies:', error);
      return [];
    }
  },

  /**
   * Get bots list for workflow control
   */
  async getBots(): Promise<Bot[]> {
    try {
      const data = await apiGet('/bots');
      return data?.data || data || [];
    } catch (error) {
      console.error('Failed to fetch bots:', error);
      return [];
    }
  },

  /**
   * Get workflow status for a bot
   */
  async getWorkflowStatus(botId: string): Promise<WorkflowStatus | null> {
    try {
      const data = await apiGet(`/strategy-lab/bots/${botId}/workflow-status`);
      return data?.data || data || null;
    } catch (error) {
      console.error('Failed to fetch workflow status:', error);
      return null;
    }
  },

  /**
   * Start a workflow for a bot
   */
  async startWorkflow(botId: string, config: {
    steps: string[];
    epochs: number;
    auto_promote: boolean;
    max_drawdown_threshold: number;
  }): Promise<void> {
    await apiPost(`/strategy-lab/bots/${botId}/workflow/start`, config);
  },

  /**
   * Stop a running workflow
   */
  async stopWorkflow(botId: string): Promise<void> {
    await apiPost(`/strategy-lab/bots/${botId}/workflow/stop`);
  },

  /**
   * Get hyperopt epochs for a strategy
   */
  async getHyperoptEpochs(strategyName: string): Promise<HyperoptEpoch[]> {
    try {
      const data = await apiGet(`/strategy-lab/hyperopt/${strategyName}/epochs`);
      return data?.data || data || [];
    } catch (error) {
      console.error('Failed to fetch hyperopt epochs:', error);
      return [];
    }
  },

  /**
   * Extract params from a specific epoch
   */
  async extractEpoch(strategyName: string, epochId: number): Promise<void> {
    await apiPost(`/strategy-lab/hyperopt/${strategyName}/extract/${epochId}`);
  },

  /**
   * Get optimization runs history
   */
  async getOptimizationRuns(limit: number = 50, timeRange?: string): Promise<OptimizationRun[]> {
    try {
      const params = timeRange && timeRange !== 'all' ? `?limit=${limit}&time_range=${timeRange}` : `?limit=${limit}`;
      const data = await apiGet('/strategy-lab/optimization-results' + params);
      return data?.data || data || [];
    } catch (error) {
      console.error('Failed to fetch optimization runs:', error);
      return [];
    }
  },
};
