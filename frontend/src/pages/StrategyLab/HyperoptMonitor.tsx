/**
 * Hyperopt Monitor Page - Real-time epoch tracking
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { strategyLabApi, HyperoptEpoch } from '../../services/strategyLabApi';
import { Card } from '../../components/common/Card';
import { useToast } from '../../components/common/Toast';

export function HyperoptMonitor() {
  const { strategyName } = useParams<{ strategyName?: string }>();
  const { showToast } = useToast();
  const [selectedStrategy, setSelectedStrategy] = useState<string>(strategyName || '');
  const [sortBy, setSortBy] = useState<'epoch' | 'profit' | 'drawdown'>('epoch');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterMinProfit, setFilterMinProfit] = useState<number | ''>('');
  const [filterMaxDrawdown, setFilterMaxDrawdown] = useState<number | ''>(2.0);

  // Get strategies list
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
  });

  // Get epochs for selected strategy
  const { data: epochs, refetch: refetchEpochs } = useQuery({
    queryKey: ['hyperopt-epochs', selectedStrategy],
    queryFn: () => selectedStrategy ? strategyLabApi.getHyperoptEpochs(selectedStrategy) : [],
    enabled: !!selectedStrategy,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Extract epoch mutation
  const extractEpoch = useMutation({
    mutationFn: (epochId: number) => strategyLabApi.extractEpoch(selectedStrategy, epochId),
    onSuccess: () => {
      showToast('Эпоха успешно извлечена', 'success');
    },
    onError: (error: any) => {
      showToast(error.message || 'Не удалось извлечь эпоху', 'error');
    },
  });

  // Real-time updates handled via refetchInterval above (10s polling)
  // TODO: Add WebSocket support for instant updates when available

  // Filter and sort epochs
  const filteredEpochs = epochs?.filter(epoch => {
    const meetsProfit = filterMinProfit === '' || (epoch.profit_total_pct || 0) >= filterMinProfit;
    const meetsDrawdown = filterMaxDrawdown === '' || (epoch.max_drawdown || 100) <= filterMaxDrawdown;
    return meetsProfit && meetsDrawdown;
  }) || [];

  const sortedEpochs = [...filteredEpochs].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'epoch':
        comparison = a.epoch - b.epoch;
        break;
      case 'profit':
        comparison = (a.profit_total_pct || 0) - (b.profit_total_pct || 0);
        break;
      case 'drawdown':
        comparison = (a.max_drawdown || 100) - (b.max_drawdown || 100);
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Find best epoch
  const bestEpoch = sortedEpochs.reduce((best, epoch) => {
    if (!best) return epoch;
    // Score: profit / (drawdown + 1) - higher is better
    const epochScore = (epoch.profit_total_pct || 0) / ((epoch.max_drawdown || 1) + 1);
    const bestScore = (best.profit_total_pct || 0) / ((best.max_drawdown || 1) + 1);
    return epochScore > bestScore ? epoch : best;
  }, null as HyperoptEpoch | null);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📈 Монитор гиперопта
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Отслеживание эпох в реальном времени и извлечение параметров
          </p>
        </div>
        <Link
          to="/strategy-lab"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          ← Назад в лабораторию стратегий
        </Link>
      </div>

      {/* Strategy Selection */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Стратегия
            </label>
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">-- Выберите стратегию --</option>
              {strategies?.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Сортировка
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="epoch">Эпоха #</option>
              <option value="profit">Прибыль %</option>
              <option value="drawdown">Drawdown</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Порядок
            </label>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {sortOrder === 'asc' ? '↑ По возрастанию' : '↓ По убыванию'}
            </button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      {selectedStrategy && (
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Мин. прибыль (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={filterMinProfit}
                onChange={(e) => setFilterMinProfit(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Макс. просадка (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={filterMaxDrawdown}
                onChange={(e) => setFilterMaxDrawdown(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex items-end">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Показано {filteredEpochs.length} из {epochs?.length || 0} эпох
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Best Epoch Highlight */}
      {bestEpoch && (
        <Card className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">🏆 Лучшая эпоха</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Epoch #{bestEpoch.epoch}
              </h3>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-green-600 dark:text-green-400 font-medium">
                  +{bestEpoch.profit_total_pct?.toFixed(2)}% прибыль
                </span>
                <span className="text-orange-600 dark:text-orange-400">
                  {bestEpoch.max_drawdown?.toFixed(2)}% просадка
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {bestEpoch.trade_count} сделок
                </span>
              </div>
            </div>
            <button
              onClick={() => extractEpoch.mutate(bestEpoch.epoch)}
              disabled={extractEpoch.isPending}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {extractEpoch.isPending ? 'Извлечение...' : '✨ Извлечь'}
            </button>
          </div>
        </Card>
      )}

      {/* Epochs Table */}
      {selectedStrategy && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Epoch</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Profit %</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Просадка</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Сделки</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">Win Rate</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Параметры</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedEpochs.map((epoch) => (
                  <tr 
                    key={epoch.epoch}
                    className={`
                      hover:bg-gray-50 dark:hover:bg-gray-800
                      ${epoch.epoch === bestEpoch?.epoch ? 'bg-green-50 dark:bg-green-900/10' : ''}
                    `}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      #{epoch.epoch}
                      {epoch.epoch === bestEpoch?.epoch && (
                        <span className="ml-2 text-xs text-green-600 dark:text-green-400">⭐</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${
                      (epoch.profit_total_pct || 0) >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {epoch.profit_total_pct?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {epoch.max_drawdown?.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {epoch.trade_count}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {epoch.win_rate ? `${epoch.win_rate.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <div className="max-w-xs truncate font-mono text-xs">
                        {Object.entries(epoch.params || {}).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ')}
                        {Object.keys(epoch.params || {}).length > 3 && '...'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => extractEpoch.mutate(epoch.epoch)}
                        disabled={extractEpoch.isPending}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded"
                      >
                        Извлечь
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedEpochs.length === 0 && (
            <div className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
              Эпохи не найдены. Запустите гиперопт, чтобы сгенерировать эпохи.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
