/**
 * Optimization Results Page - Track improvements over time
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { strategyLabApi } from '../../services/strategyLabApi';
import { Card } from '../../components/common/Card';
import { useTranslation } from 'react-i18next';

export function OptimizationResults() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');

  const { data: runs, isLoading } = useQuery({
    queryKey: ['optimization-runs', timeRange],
    queryFn: () => strategyLabApi.getOptimizationRuns(100, timeRange),
  });

  const { data: strategies } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
  });

  const filteredRuns = runs?.filter(r =>
    filterStrategy === 'all' || r.strategy_name === filterStrategy
  ) || [];

  // Group by strategy for comparison
  const byStrategy = filteredRuns.reduce((acc, run) => {
    if (!acc[run.strategy_name]) acc[run.strategy_name] = [];
    acc[run.strategy_name].push(run);
    return acc;
  }, {} as Record<string, typeof filteredRuns>);

  // Compute strategy summaries
  const summaries = Object.entries(byStrategy).map(([name, stratRuns]) => {
    const completed = stratRuns.filter(r => r.status === 'completed');
    const profits = completed.map(r => r.result_profit_pct || 0);
    const latestRun = stratRuns.sort((a, b) =>
      new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0];

    return {
      name,
      totalRuns: stratRuns.length,
      completedRuns: completed.length,
      bestProfit: profits.length ? Math.max(...profits) : null,
      avgProfit: profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : null,
      latestRun,
      trend: profits.length >= 2
        ? profits[profits.length - 1] > profits[0] ? 'improving' : 'declining'
        : 'neutral',
    };
  }).sort((a, b) => (b.bestProfit || -999) - (a.bestProfit || -999));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🏆 Результаты оптимизации
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Отслеживание улучшений стратегий во времени
          </p>
        </div>
        <Link
          to="/strategy-lab"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Назад в лабораторию стратегий
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            {(['7d', '30d', '90d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {range === 'all' ? 'За всё время' : `Последние ${range}`}
              </button>
            ))}
          </div>
          <select
            value={filterStrategy}
            onChange={(e) => setFilterStrategy(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="all">Все стратегии</option>
            {strategies?.map(s => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Всего прогонов</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredRuns.length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Проверено стратегий</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {Object.keys(byStrategy).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Лучшая прибыль</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {summaries.length && summaries[0].bestProfit !== null
              ? `+${summaries[0].bestProfit.toFixed(2)}%`
              : '--'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Доля успешных</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredRuns.length
              ? `${((filteredRuns.filter(r => (r.result_profit_pct || 0) > 0).length / filteredRuns.length) * 100).toFixed(0)}%`
              : '--'}
          </p>
        </Card>
      </div>

      {/* Strategy Comparison Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Сравнение производительности стратегий
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Стратегия</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Прогоны</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Лучшая прибыль</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Средняя прибыль</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Тренд</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Последний прогон</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">Загрузка...</td>
                </tr>
              ) : summaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    Оптимизационных прогонов пока нет. Запустите workflow, чтобы увидеть результаты.
                  </td>
                </tr>
              ) : summaries.map(summary => (
                <tr key={summary.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {summary.name}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {summary.completedRuns}/{summary.totalRuns}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${
                    summary.bestProfit !== null && summary.bestProfit >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {summary.bestProfit !== null ? `${summary.bestProfit >= 0 ? '+' : ''}${summary.bestProfit.toFixed(2)}%` : '--'}
                  </td>
                  <td className={`px-4 py-3 text-right ${
                    summary.avgProfit !== null && summary.avgProfit >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {summary.avgProfit !== null ? `${summary.avgProfit >= 0 ? '+' : ''}${summary.avgProfit.toFixed(2)}%` : '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`
                      ${summary.trend === 'improving' ? 'text-green-600 dark:text-green-400' : ''}
                      ${summary.trend === 'declining' ? 'text-red-600 dark:text-red-400' : ''}
                      ${summary.trend === 'neutral' ? 'text-gray-500' : ''}
                    `}>
                      {summary.trend === 'improving' ? '📈' : summary.trend === 'declining' ? '📉' : '➡️'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {summary.latestRun ? new Date(summary.latestRun.started_at).toLocaleString() : '--'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      to={`/strategy-lab/hyperopt/${summary.name}`}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-xs"
                    >
                      Эпохи
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Run History */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            История прогонов
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {filteredRuns.sort((a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          ).map((run) => (
            <div key={run.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  run.status === 'completed' ? 'bg-green-500' :
                  run.status === 'running' ? 'bg-orange-500 animate-pulse' :
                  run.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                }`} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {run.strategy_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {run.process_type} • {new Date(run.started_at).toLocaleString()}
                    {run.duration_seconds && ` • ${Math.floor(run.duration_seconds / 60)}m ${run.duration_seconds % 60}s`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {run.result_profit_pct !== undefined && run.result_profit_pct !== null && (
                  <p className={`font-medium text-sm ${
                    run.result_profit_pct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {run.result_profit_pct >= 0 ? '+' : ''}{run.result_profit_pct.toFixed(2)}%
                  </p>
                )}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  run.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' :
                  run.status === 'running' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' :
                  run.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-200'
                }`}>
                  {run.status}
                </span>
              </div>
            </div>
          ))}
          {filteredRuns.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
              По выбранным фильтрам прогоны не найдены.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
