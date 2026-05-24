/**
 * Strategy Lab Main Page - V6 Entry Point
 * Central hub for strategy optimization and automation
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { strategyLabApi } from '../../services/strategyLabApi';
import { Card } from '../../components/common/Card';

export function StrategyLab() {
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
  });

  const { data: recentRuns, isLoading: runsLoading } = useQuery({
    queryKey: ['optimization-runs', { limit: 5 }],
    queryFn: () => strategyLabApi.getOptimizationRuns(5),
  });

  const stats = {
    totalStrategies: strategies?.length || 0,
    completedRuns: recentRuns?.filter(r => r.status === 'completed').length || 0,
    activeWorkflows: recentRuns?.filter(r => r.status === 'running').length || 0,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔧 Лаборатория стратегий
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Автоматизированная оптимизация стратегий и управление workflow
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm font-medium">
            V6
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Стратегии</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {strategiesLoading ? '...' : stats.totalStrategies}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Завершённые прогоны</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {runsLoading ? '...' : stats.completedRuns}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Активные workflow</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {runsLoading ? '...' : stats.activeWorkflows}
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/strategy-lab/strategies"
          className="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
        >
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Список стратегий
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Просмотр всех {stats.totalStrategies} стратегий с метаданными и индикаторами
          </p>
        </Link>

        <Link
          to="/strategy-lab/workflow"
          className="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all"
        >
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">⚙️</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Управление workflow
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Automate: stop → download → backtest → hyperopt → deploy
          </p>
        </Link>

        <Link
          to="/strategy-lab/hyperopt"
          className="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 transition-all"
        >
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">📈</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Монитор гиперопта
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Отслеживание эпох в реальном времени и извлечение параметров
          </p>
        </Link>

        <Link
          to="/strategy-lab/results"
          className="group block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-green-300 dark:hover:border-green-700 transition-all"
        >
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">🏆</span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Результаты оптимизации
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Отслеживание улучшений V1 → V2 → V3 и победивших конфигов
          </p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Недавняя активность
          </h2>
          <Link
            to="/strategy-lab/results"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Показать всё →
          </Link>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {runsLoading ? (
            <div className="px-6 py-8 text-center text-gray-500">Загрузка...</div>
          ) : recentRuns?.length ? (
            recentRuns.map((run) => (
              <div key={run.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`
                    w-2 h-2 rounded-full
                    ${run.status === 'completed' ? 'bg-green-500' : ''}
                    ${run.status === 'running' ? 'bg-orange-500 animate-pulse' : ''}
                    ${run.status === 'error' ? 'bg-red-500' : ''}
                    ${run.status === 'stopped' ? 'bg-gray-500' : ''}
                  `} />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {run.strategy_name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {run.process_type} • {new Date(run.started_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {run.result_profit_pct !== undefined && (
                    <p className={`font-medium ${
                      run.result_profit_pct >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {run.result_profit_pct >= 0 ? '+' : ''}{run.result_profit_pct.toFixed(2)}%
                    </p>
                  )}
                  <span className={`
                    px-2 py-0.5 rounded text-xs font-medium
                    ${run.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : ''}
                    ${run.status === 'running' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' : ''}
                    ${run.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' : ''}
                  `}>
                    {run.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              Оптимизационных прогонов пока нет. Запустите workflow, чтобы увидеть результаты.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
