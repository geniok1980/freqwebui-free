/**
 * Bot Comparison page for comparing multiple bots side by side.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';

interface Bot {
  id: string;
  name: string;
  environment: string;
  health_state: string;
  exchange: string | null;
  strategy: string | null;
  is_dryrun: boolean;
  performance?: {
    total_profit: number;
    total_profit_pct: number;
    win_rate: number;
    total_trades: number;
    avg_duration_mins: number;
  };
}

interface PerformanceData {
  total_profit: number;
  total_profit_pct: number;
  win_rate: number;
  total_trades: number;
  avg_duration_mins: number;
}

export function Compare() {
  const { t } = useTranslation();
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all bots
  const { data: bots, isLoading } = useQuery({
    queryKey: ['bots', 'comparison'],
    queryFn: async (): Promise<Bot[]> => {
      const response = await api.get<Bot[]>('/bots');
      return response.data;
    },
  });

  // Fetch performance data for selected bots
  const { data: performanceData } = useQuery({
    queryKey: ['bots', 'performance', selectedBots],
    queryFn: async () => {
      const promises = selectedBots.map(id =>
        api.get<PerformanceData>(`/bots/${id}/performance`)
          .then(r => ({ id, data: r.data }))
          .catch(() => ({ id, data: null }))
      );
      return Promise.all(promises);
    },
    enabled: selectedBots.length > 0,
  });

  // Combine bot data with performance
  const comparisonData = useMemo(() => {
    if (!bots || !performanceData) return [];

    return selectedBots.map(id => {
      const bot = bots.find(b => b.id === id);
      const perf = performanceData.find(p => p.id === id)?.data;
      return { ...bot, performance: perf };
    }).filter(Boolean);
  }, [bots, performanceData, selectedBots]);

  // Filter bots for selection
  const filteredBots = useMemo(() => {
    if (!bots) return [];
    if (!searchQuery) return bots;
    const query = searchQuery.toLowerCase();
    return bots.filter(
      bot =>
        bot.name.toLowerCase().includes(query) ||
        bot.exchange?.toLowerCase().includes(query) ||
        bot.strategy?.toLowerCase().includes(query)
    );
  }, [bots, searchQuery]);

  const toggleBot = (botId: string) => {
    setSelectedBots(prev =>
      prev.includes(botId)
        ? prev.filter(id => id !== botId)
        : prev.length < 5
        ? [...prev, botId]
        : prev
    );
  };

  const removeBot = (botId: string) => {
    setSelectedBots(prev => prev.filter(id => id !== botId));
  };

  const clearAll = () => {
    setSelectedBots([]);
  };

  // Find best/worst values for highlighting
  const getBestValue = (key: keyof NonNullable<Bot['performance']>, higher: boolean = true) => {
    if (!comparisonData || comparisonData.length < 2) return null;
    const values = comparisonData
      .map(b => b?.performance?.[key])
      .filter((v): v is number => v !== undefined && v !== null);
    if (values.length === 0) return null;
    return higher ? Math.max(...values) : Math.min(...values);
  };

  const isHighlighted = (value: number | undefined, bestValue: number | null, _higher: boolean = true) => {
    if (value === undefined || bestValue === null) return false;
    return value === bestValue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Сравнение ботов</h1>
        {selectedBots.length > 0 && (
          <button
            onClick={clearAll}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            Очистить всё
          </button>
        )}
      </div>

      {/* Bot Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Выбор ботов для сравнения
          <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
            ({selectedBots.length}/5 выбрано)
          </span>
        </h2>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск ботов по имени, бирже или стратегии..."
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Selected Bots */}
        {selectedBots.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedBots.map(id => {
              const bot = bots?.find(b => b.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                >
                  {bot?.name || id}
                  <button
                    onClick={() => removeBot(id)}
                    className="hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Bot List */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto">
            {filteredBots?.map(bot => (
              <button
                key={bot.id}
                onClick={() => toggleBot(bot.id)}
                disabled={!selectedBots.includes(bot.id) && selectedBots.length >= 5}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selectedBots.includes(bot.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${
                  !selectedBots.includes(bot.id) && selectedBots.length >= 5
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      bot.health_state === 'healthy'
                        ? 'bg-green-500'
                        : bot.health_state === 'degraded'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {bot.name}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {bot.exchange || '-'} / {bot.strategy || '-'}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comparison Table */}
      {selectedBots.length >= 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Сравнение производительности
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metric
                  </th>
                  {comparisonData.map(bot => (
                    <th
                      key={bot?.id}
                      className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="truncate max-w-[120px]">{bot?.name}</span>
                        {bot?.is_dryrun && (
                          <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                            Dry
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {/* Status */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Status</td>
                  {comparisonData.map(bot => (
                    <td key={bot?.id} className="px-6 py-4 text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          bot?.health_state === 'healthy'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : bot?.health_state === 'degraded'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        }`}
                      >
                        {bot?.health_state}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Exchange */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Exchange</td>
                  {comparisonData.map(bot => (
                    <td key={bot?.id} className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white">
                      {bot?.exchange || '-'}
                    </td>
                  ))}
                </tr>

                {/* Strategy */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Strategy</td>
                  {comparisonData.map(bot => (
                    <td key={bot?.id} className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white truncate max-w-[150px]">
                      {bot?.strategy || '-'}
                    </td>
                  ))}
                </tr>

                {/* Total Profit */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Total Profit</td>
                  {comparisonData.map(bot => {
                    const value = bot?.performance?.total_profit;
                    const best = getBestValue('total_profit');
                    return (
                      <td
                        key={bot?.id}
                        className={`px-6 py-4 text-sm text-center font-medium ${
                          value !== undefined && value >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        } ${isHighlighted(value, best) ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        {value !== undefined ? `${value >= 0 ? '+' : ''}${value.toFixed(4)}` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Total Profit % */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Total Profit %</td>
                  {comparisonData.map(bot => {
                    const value = bot?.performance?.total_profit_pct;
                    const best = getBestValue('total_profit_pct');
                    return (
                      <td
                        key={bot?.id}
                        className={`px-6 py-4 text-sm text-center font-medium ${
                          value !== undefined && value >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        } ${isHighlighted(value, best) ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        {value !== undefined ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Win Rate */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Win Rate</td>
                  {comparisonData.map(bot => {
                    const value = bot?.performance?.win_rate;
                    const best = getBestValue('win_rate');
                    return (
                      <td
                        key={bot?.id}
                        className={`px-6 py-4 text-sm text-center font-medium ${
                          value !== undefined && value >= 50
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        } ${isHighlighted(value, best) ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
                      >
                        {value !== undefined ? `${value.toFixed(1)}%` : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Total Trades */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Total Trades</td>
                  {comparisonData.map(bot => {
                    const value = bot?.performance?.total_trades;
                    const best = getBestValue('total_trades');
                    return (
                      <td
                        key={bot?.id}
                        className={`px-6 py-4 text-sm text-center text-gray-900 dark:text-white ${
                          isHighlighted(value, best) ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''
                        }`}
                      >
                        {value !== undefined ? value : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Avg Duration */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Avg Duration</td>
                  {comparisonData.map(bot => {
                    const value = bot?.performance?.avg_duration_mins;
                    const best = getBestValue('avg_duration_mins', false);
                    const formatDuration = (mins: number) => {
                      if (mins < 60) return `${mins.toFixed(0)}m`;
                      const hours = Math.floor(mins / 60);
                      const remainingMins = mins % 60;
                      return `${hours}h ${remainingMins.toFixed(0)}m`;
                    };
                    return (
                      <td
                        key={bot?.id}
                        className={`px-6 py-4 text-sm text-center text-gray-900 dark:text-white ${
                          isHighlighted(value, best, false) ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''
                        }`}
                      >
                        {value !== undefined ? formatDuration(value) : '-'}
                      </td>
                    );
                  })}
                </tr>

                {/* Environment */}
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">Environment</td>
                  {comparisonData.map(bot => (
                    <td key={bot?.id} className="px-6 py-4 text-sm text-center text-gray-900 dark:text-white capitalize">
                      {bot?.environment || '-'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block w-3 h-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded mr-1"></span>
              Лучшее значение
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedBots.length < 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Выберите минимум 2 бота для сравнения
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Выберите до 5 ботов из списка выше, чтобы увидеть сравнение их производительности.
          </p>
        </div>
      )}
    </div>
  );
}
