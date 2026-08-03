/**
 * Bot Analytics component with performance charts and statistics.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../../services/api';
import type { Trade } from '../../types';
import { format, differenceInMinutes, startOfDay, eachDayOfInterval, subDays } from 'date-fns';

interface BotAnalyticsProps {
  botId: string;
}

export function BotAnalytics({ botId }: BotAnalyticsProps) {
  const { t } = useTranslation();
  const { data: trades, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['bot', botId, 'trades', 'all'],
    queryFn: async (): Promise<Trade[]> => {
      const response = await api.get<Trade[]>(`/bots/${botId}/trades`);
      return response.data;
    },
    enabled: !!botId,
  });

  // Error state
  if (isError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
        <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">
          Failed to Load Analytics
        </h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">
          {(error as Error)?.message || 'Unable to fetch trade data for analytics.'}
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Calculate cumulative profit over time
  const cumulativeProfitData = useMemo(() => {
    if (!trades) return [];

    const closedTrades = trades
      .filter(t => !t.is_open && t.close_date)
      .sort((a, b) => new Date(a.close_date!).getTime() - new Date(b.close_date!).getTime());

    let cumulative = 0;
    return closedTrades.map(trade => {
      cumulative += trade.close_profit_abs ?? 0;
      return {
        date: format(new Date(trade.close_date!), 'MM/dd'),
        profit: cumulative,
        trade: trade.pair,
      };
    });
  }, [trades]);

  // Daily profit aggregation (last 30 days)
  const dailyProfitData = useMemo(() => {
    if (!trades) return [];

    const closedTrades = trades.filter(t => !t.is_open && t.close_date);
    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const days = eachDayOfInterval({ start: thirtyDaysAgo, end: now });

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayTrades = closedTrades.filter(t => {
        const closeDate = new Date(t.close_date!);
        return closeDate >= dayStart && closeDate < dayEnd;
      });

      const profit = dayTrades.reduce((sum, t) => sum + (t.close_profit_abs ?? 0), 0);
      const tradeCount = dayTrades.length;

      return {
        date: format(day, 'MM/dd'),
        profit: parseFloat(profit.toFixed(4)),
        trades: tradeCount,
      };
    });
  }, [trades]);

  // Pair performance distribution
  const pairDistribution = useMemo(() => {
    if (!trades) return [];

    const closedTrades = trades.filter(t => !t.is_open);
    const pairStats: Record<string, { profit: number; count: number; wins: number }> = {};

    closedTrades.forEach(trade => {
      const pair = trade.pair;
      if (!pairStats[pair]) {
        pairStats[pair] = { profit: 0, count: 0, wins: 0 };
      }
      pairStats[pair].profit += trade.close_profit_abs ?? 0;
      pairStats[pair].count += 1;
      if ((trade.close_profit ?? 0) > 0) {
        pairStats[pair].wins += 1;
      }
    });

    return Object.entries(pairStats)
      .map(([pair, stats]) => ({
        pair,
        profit: parseFloat(stats.profit.toFixed(4)),
        count: stats.count,
        winRate: stats.count > 0 ? (stats.wins / stats.count * 100) : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
  }, [trades]);

  // Trade duration distribution
  const durationDistribution = useMemo(() => {
    if (!trades) return [];

    const closedTrades = trades.filter(t => !t.is_open && t.close_date);
    const buckets = {
      '< 1h': 0,
      '1-4h': 0,
      '4-12h': 0,
      '12-24h': 0,
      '1-3d': 0,
      '> 3d': 0,
    };

    closedTrades.forEach(trade => {
      const minutes = differenceInMinutes(
        new Date(trade.close_date!),
        new Date(trade.open_date)
      );

      if (minutes < 60) buckets['< 1h']++;
      else if (minutes < 240) buckets['1-4h']++;
      else if (minutes < 720) buckets['4-12h']++;
      else if (minutes < 1440) buckets['12-24h']++;
      else if (minutes < 4320) buckets['1-3d']++;
      else buckets['> 3d']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [trades]);

  // Win/Loss distribution
  const winLossData = useMemo(() => {
    if (!trades) return [];

    const closedTrades = trades.filter(t => !t.is_open);
    const wins = closedTrades.filter(t => (t.close_profit ?? 0) > 0).length;
    const losses = closedTrades.filter(t => (t.close_profit ?? 0) < 0).length;
    const breakeven = closedTrades.filter(t => (t.close_profit ?? 0) === 0).length;

    return [
      { name: 'Wins', value: wins, color: '#10B981' },
      { name: 'Losses', value: losses, color: '#EF4444' },
      { name: 'Breakeven', value: breakeven, color: '#6B7280' },
    ].filter(d => d.value > 0);
  }, [trades]);

  // Exit reason distribution
  const exitReasonData = useMemo(() => {
    if (!trades) return [];

    const closedTrades = trades.filter(t => !t.is_open);
    const reasons: Record<string, number> = {};

    closedTrades.forEach(trade => {
      const reason = trade.exit_reason || 'Unknown';
      reasons[reason] = (reasons[reason] || 0) + 1;
    });

    return Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [trades]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-64 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('analytics.noData')}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Start trading to see performance analytics.
        </p>
      </div>
    );
  }

  const closedTradesCount = trades.filter(t => !t.is_open).length;

  if (closedTradesCount === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('analytics.noClosedTrades')}</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Analytics will appear once trades are closed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cumulative Profit Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">{t('analytics.cumulativeProfit')}</h3>
        <div className="h-48 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeProfitData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis dataKey="date" className="text-xs" tick={{ fill: '#9CA3AF' }} />
              <YAxis className="text-xs" tick={{ fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--tooltip-bg, #1F2937)',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#F9FAFB',
                }}
                formatter={(value: number) => [value.toFixed(4), t('bots.profit')]}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Daily Profit */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">Daily Profit (Last 30 Days)</h3>
          <div className="h-40 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyProfitData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: '#9CA3AF' }} interval="preserveStartEnd" />
                <YAxis className="text-xs" tick={{ fill: '#9CA3AF' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #1F2937)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#F9FAFB',
                  }}
                />
                <Bar dataKey="profit" fill="#3B82F6" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">{t('analytics.winLossDistribution')}</h3>
          <div className="h-40 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={winLossData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {winLossData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trade Duration Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">{t('analytics.tradeDuration')}</h3>
          <div className="h-40 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" className="text-xs" tick={{ fill: '#9CA3AF' }} />
                <YAxis type="category" dataKey="range" className="text-xs" tick={{ fill: '#9CA3AF' }} width={60} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #1F2937)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#F9FAFB',
                  }}
                />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Exit Reasons */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">{t('analytics.exitReasons')}</h3>
          <div className="h-40 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exitReasonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis type="number" className="text-xs" tick={{ fill: '#9CA3AF' }} />
                <YAxis type="category" dataKey="reason" className="text-xs" tick={{ fill: '#9CA3AF' }} width={80} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #1F2937)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#F9FAFB',
                  }}
                />
                <Bar dataKey="count" fill="#F59E0B" radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pair Performance Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 sm:mb-4">{t('analytics.performanceByPair')}</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-2 sm:px-4 py-2">{t('bots.pair')}</th>
                               <th className="px-2 sm:px-4 py-2">{t('bots.trades')}</th>
                               <th className="px-2 sm:px-4 py-2">{t('bots.winrate')}</th>
                               <th className="px-2 sm:px-4 py-2">{t('bots.profit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pairDistribution.map((pair) => (
                <tr key={pair.pair} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-2 sm:px-4 py-2 font-medium text-gray-900 dark:text-white text-sm sm:text-base">
                    {pair.pair}
                  </td>
                  <td className="px-2 sm:px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                    {pair.count}
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    <span className={`text-sm font-medium ${pair.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pair.winRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2">
                    <span className={`text-sm font-medium ${pair.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {pair.profit >= 0 ? '+' : ''}{pair.profit.toFixed(4)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
