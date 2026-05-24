/**
 * Backtest Results page for viewing strategy backtest data.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
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

export function Backtest() {
  const [sortBy, setSortBy] = useState<'profit' | 'trades' | 'winrate' | 'drawdown'>('profit');

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
          Результаты бэктеста
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          После миграции SQLite → PostgreSQL
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Стратегии</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary?.total_strategies || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Прибыльные</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summary?.profitable || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Убыточные</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {summary?.unprofitable || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Средняя прибыль</p>
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
          Сравнение прибыли
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
                  formatter={(value: number) => [formatProfit(value), 'Прибыль %']}
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
            Нет данных
          </div>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 py-2">Сортировка:</span>
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
            {sort === 'profit' ? 'Прибыль' : sort === 'trades' ? 'Сделки' : sort === 'winrate' ? 'Винрейт' : 'Просадка'}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Результаты стратегий
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ранг</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Стратегия</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Таймфрейм</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Прибыль</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Винрейт</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Сделки</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Просадка</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sharpe</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Лучшая пара</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {resultsLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Загрузка результатов бэктеста...
                  </td>
                </tr>
              ) : !sortedResults?.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Результаты бэктеста не найдены.
                  </td>
                </tr>
              ) : (
                sortedResults.map((result, index) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
          О результатах бэктеста
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Эти результаты получены из бэктестов за 2025-01-01 — 2025-02-14.
          GKD_FisherTransformV4_ML — явный победитель с прибылью +115.75% и винрейтом 100%.
          AlexStarMark показывает нереалистичные +46,699% — вероятно, ошибка сайзинга позиции.
          Данные импортированы из SQLite и сейчас хранятся в PostgreSQL дашборда.
        </p>
      </div>
    </div>
  );
}
