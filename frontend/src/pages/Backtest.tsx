/**
 * Backtest Results page for viewing strategy backtest data,
 * launching new backtests, browsing recommended strategies, and running AI analysis.
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { strategyLabApi, Strategy } from '../services/strategyLabApi';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';
import { DeployBotModal, StrategyRecommendation } from '../components/bot/DeployBotModal';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BacktestResult {
  id: number;
  strategy_name: string;
  timeframe: string;
  timerange: string;
  start_balance: number;
  final_balance: number;
  total_profit_pct: number;
  total_profit_abs: number;
  total_trades: number;
  win_rate: number;
  avg_profit_pct: number;
  max_drawdown_pct: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  profit_factor: number;
  best_pair: string;
  worst_pair: string;
  backtest_date: string;
}

interface BacktestSummary {
  total_strategies: number;
  profitable: number;
  unprofitable: number;
  avg_profit_pct: number;
  best_profit_pct: number;
  worst_profit_pct: number;
  avg_win_rate: number;
  total_trades: number;
}

interface RecommendationsResponse {
  status: string;
  data: StrategyRecommendation[];
}

function formatProfit(value: number | null): string {
  if (value === null) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
}

function getProfitColor(value: number): string {
  if (value > 100) return '#F59E0B'; // Orange for extreme (bug)
  if (value > 0) return '#10B981'; // Green
  if (value > -50) return '#EF4444'; // Red
  return '#7F1D1D'; // Dark red
}

function getScoreBadgeColor(score: number): string {
  if (score >= 7) return 'bg-green-600 text-white';
  if (score >= 5) return 'bg-yellow-500 text-black';
  return 'bg-red-600 text-white';
}

function getRecBadgeColor(rec: string): string {
  if (rec === 'go') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
  if (rec === 'watch') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
}

export function Backtest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sortBy, setSortBy] = useState<'profit' | 'trades' | 'winrate' | 'drawdown'>('profit');

  // Launch panel state
  const [selectedLaunchStrategy, setSelectedLaunchStrategy] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deploy modal state
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployModalStrategy, setDeployModalStrategy] = useState<string | undefined>(undefined);
  const [deployModalRecommendation, setDeployModalRecommendation] = useState<StrategyRecommendation | undefined>(undefined);

  // AI analysis state per result row
  const [aiAnalyses, setAiAnalyses] = useState<Record<number, {
    loading: boolean;
    analysis?: string;
    error?: string;
  }>>({});

  // Expando state per result row
  const [expandedAi, setExpandedAi] = useState<Record<number, boolean>>({});

  // Fetch strategies
  const { data: strategies } = useQuery({
    queryKey: ['strategy-lab', 'strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
  });

  // Fetch recommendations
  const { data: recommendationsData } = useQuery<RecommendationsResponse>({
    queryKey: ['strategy-lab', 'recommendations'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/strategy-lab/recommendations`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });
  const recommendations = recommendationsData?.data || [];

  // Fetch existing results
  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['backtest', 'results'],
    queryFn: async () => {
      const response = await api.get<{ results: BacktestResult[] }>('/backtest');
      return response.data?.results || [];
    },
  });

  const { data: summary, isLoading: _summaryLoading } = useQuery({
    queryKey: ['backtest', 'summary'],
    queryFn: async () => {
      const response = await api.get<BacktestSummary>('/backtest/summary');
      return response.data;
    },
  });

  // Launch backtest
  const handleLaunchBacktest = async () => {
    if (!selectedLaunchStrategy) return;
    setIsLaunching(true);
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/strategy-lab/workflow/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          strategy: selectedLaunchStrategy,
          steps: ['backtest'],
          epochs: 30,
          auto_promote: true,
          max_drawdown_threshold: 2.0,
          bot_id: null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setToastMessage({ type: 'success', text: t('backtest.runStarted') });
      queryClient.invalidateQueries({ queryKey: ['backtest'] });
    } catch {
      setToastMessage({ type: 'error', text: t('backtest.runFailed') });
    } finally {
      setIsLaunching(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // AI analysis mutation
  const runAiAnalysis = async (runId: number) => {
    setAiAnalyses((prev) => ({ ...prev, [runId]: { loading: true } }));
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/strategy-lab/ai/run-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ run_id: runId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiAnalyses((prev) => ({
        ...prev,
        [runId]: { loading: false, analysis: data?.analysis || data?.data?.analysis || JSON.stringify(data) },
      }));
      setExpandedAi((prev) => ({ ...prev, [runId]: true }));
    } catch (err) {
      setAiAnalyses((prev) => ({
        ...prev,
        [runId]: { loading: false, error: (err as Error).message },
      }));
    }
  };

  // Open deploy modal
  const openDeployModal = (strategyName: string, rec?: StrategyRecommendation) => {
    setDeployModalStrategy(strategyName);
    setDeployModalRecommendation(rec);
    setDeployModalOpen(true);
  };

  // Deploy success handler
  const handleDeploySuccess = (_bot: unknown) => {
    // Bot is selected by parent (FreqtradeBots doesn't apply here)
    queryClient.invalidateQueries({ queryKey: ['bots'] });
  };

  const sortedResults = resultsData?.slice().sort((a, b) => {
    switch (sortBy) {
      case 'profit': return b.total_profit_pct - a.total_profit_pct;
      case 'trades': return b.total_trades - a.total_trades;
      case 'winrate': return (b.win_rate || 0) - (a.win_rate || 0);
      case 'drawdown': return (a.max_drawdown_pct || 0) - (b.max_drawdown_pct || 0);
      default: return 0;
    }
  });

  const chartData = sortedResults?.map(r => ({
    name: r.strategy_name.length > 15 ? r.strategy_name.substring(0, 15) + '...' : r.strategy_name,
    profit: r.total_profit_pct,
    color: getProfitColor(r.total_profit_pct),
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('backtest.title')}
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {t('backtest.afterMigration')}
        </span>
      </div>

      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`px-4 py-3 rounded-lg text-sm font-medium ${
            toastMessage.type === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Launch panel */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t('backtest.runBacktest')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('backtest.runBacktestDesc')}
        </p>
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('backtest.selectStrategy')}
            </label>
            <select
              value={selectedLaunchStrategy}
              onChange={(e) => setSelectedLaunchStrategy(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">-- {t('backtest.selectStrategy')} --</option>
              {(strategies || []).map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleLaunchBacktest}
            disabled={!selectedLaunchStrategy || isLaunching}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
          >
            {isLaunching ? t('backtest.running') : t('backtest.startRun')}
          </button>
        </div>
      </div>

      {/* Recommended strategies */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('backtest.recommended')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('backtest.recommendedDesc')}
          </p>
        </div>
        <div className="overflow-x-auto">
          {recommendations.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 text-sm">
              {t('backtest.noRecommendations')}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('backtest.strategy')}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('backtest.score')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    %
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('backtest.profit')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('common.drawdown')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('backtest.sharpe')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('common.trades')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('common.status')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {recommendations.map((rec, idx) => (
                  <tr
                    key={`${rec.strategy_name}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {rec.strategy_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getScoreBadgeColor(rec.score)}`}
                      >
                        {rec.score}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {rec.percent?.toFixed(1)}%
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm text-right ${
                      (rec.profit_pct ?? 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {rec.profit_pct != null ? `${rec.profit_pct >= 0 ? '+' : ''}${rec.profit_pct.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {rec.max_drawdown_pct != null ? `${rec.max_drawdown_pct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {rec.sharpe_ratio?.toFixed(2) || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {rec.total_trades ?? '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRecBadgeColor(rec.recommendation)}`}>
                        {rec.recommendation === 'go'
                          ? t('backtest.recGo')
                          : rec.recommendation === 'watch'
                            ? t('backtest.recWatch')
                            : t('backtest.recNo')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => openDeployModal(rec.strategy_name, rec)}
                        className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        {t('backtest.deployBot')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('backtest.strategies')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.total_strategies || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('backtest.profitable')}</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summary?.profitable || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('backtest.unprofitable')}</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary?.unprofitable || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('backtest.avgProfit')}</p>
          <p className={`text-2xl font-bold ${
            (summary?.avg_profit_pct || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {formatProfit(summary?.avg_profit_pct || 0)}
          </p>
        </div>
      </div>

      {/* Profit Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('backtest.profitComparison')}
        </h2>
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                <XAxis
                  type="number"
                  stroke="#6B7280"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(v) => `${v.toFixed(0)}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#6B7280"
                  fontSize={11}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value: number) => [formatProfit(value), t('backtest.profitPercent')]}
                />
                <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            {t('backtest.noData')}
          </div>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 py-2">{t('backtest.sortBy')}</span>
        {(['profit', 'trades', 'winrate', 'drawdown'] as const).map((sort) => (
          <button
            key={sort}
            onClick={() => setSortBy(sort)}
            className={`px-3 py-1 text-sm rounded ${
              sortBy === sort
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {sort === 'profit' ? t('backtest.profit') : sort === 'trades' ? t('backtest.trades') : sort === 'winrate' ? t('backtest.winrate') : t('backtest.drawdown')}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('backtest.strategyResults')}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.rank')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.strategy')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.timeframe')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.profit')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.winrate')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.trades')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.drawdown')}</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.sharpe')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.bestPair')}</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('backtest.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {resultsLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    {t('backtest.loading')}
                  </td>
                </tr>
              ) : !sortedResults?.length ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    {t('backtest.noResults')}
                  </td>
                </tr>
              ) : (
                sortedResults.map((result, index) => (
                  <>
                    <tr
                      key={result.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                        index === 0 ? 'bg-green-50 dark:bg-green-900/20' : ''
                      }`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {result.strategy_name}
                        {result.total_profit_pct > 1000 && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 px-2 py-0.5 rounded">
                            BUG?
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {result.timeframe}
                      </td>
                      <td className={`px-4 py-4 whitespace-nowrap text-sm text-right font-bold ${
                        (result.total_profit_pct || 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatProfit(result.total_profit_pct)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {result.win_rate ? `${result.win_rate.toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {result.total_trades || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {result.max_drawdown_pct ? `${result.max_drawdown_pct.toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                        {result.sharpe?.toFixed(2) || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-left text-gray-500 dark:text-gray-400">
                        {result.best_pair || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => navigate(`/strategy-lab/hyperopt/${encodeURIComponent(result.strategy_name)}`)}
                            className="text-xs px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                            title={t('backtest.runHyperopt')}
                          >
                            {t('backtest.runHyperopt')}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeployModal(result.strategy_name)}
                            className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                            title={t('backtest.deployBot')}
                          >
                            {t('backtest.deployBot')}
                          </button>
                          <button
                            type="button"
                            onClick={() => runAiAnalysis(result.id)}
                            disabled={aiAnalyses[result.id]?.loading}
                            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors disabled:opacity-50"
                            title={t('backtest.aiAnalysis')}
                          >
                            {aiAnalyses[result.id]?.loading ? '...' : t('backtest.aiAnalysis')}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* AI analysis collapsible row */}
                    {(aiAnalyses[result.id]?.analysis || aiAnalyses[result.id]?.error) && (
                      <tr key={`${result.id}-ai`} className="bg-gray-50 dark:bg-gray-900/50">
                        <td colSpan={10} className="px-6 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAi((prev) => ({
                                  ...prev,
                                  [result.id]: !prev[result.id],
                                }))
                              }
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {expandedAi[result.id]
                                ? t('common.showLess')
                                : t('common.showMore')}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {t('backtest.aiAnalysis')} — {result.strategy_name}
                            </span>
                          </div>
                          {expandedAi[result.id] && (
                            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
                              {aiAnalyses[result.id]?.analysis || (
                                <span className="text-red-600 dark:text-red-400">
                                  {aiAnalyses[result.id]?.error}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          {t('backtest.legend')}
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {t('backtest.aboutDesc')}
        </p>
      </div>

      {/* DeployBotModal */}
      <DeployBotModal
        open={deployModalOpen}
        onClose={() => {
          setDeployModalOpen(false);
          setDeployModalStrategy(undefined);
          setDeployModalRecommendation(undefined);
        }}
        initialStrategy={deployModalStrategy}
        initialRecommendation={deployModalRecommendation}
        onSuccess={handleDeploySuccess}
      />
    </div>
  );
}
