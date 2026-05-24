/**
 * Bot trades list component with statistics and pagination.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { Trade } from '../../types';
import { format } from 'date-fns';

/**
 * Export trades to CSV format and trigger download.
 */
function exportTradesToCSV(trades: Trade[], filename: string) {
  const headers = [
    'ID',
    'Pair',
    'Side',
    'Leverage',
    'Open Date',
    'Close Date',
    'Open Rate',
    'Close Rate',
    'Stake Amount',
    'Amount',
    'Profit %',
    'Profit Abs',
    'Exit Reason',
    'Duration (minutes)',
  ];

  const rows = trades.map(trade => {
    const openDate = new Date(trade.open_date);
    const closeDate = trade.close_date ? new Date(trade.close_date) : null;
    const durationMs = closeDate ? closeDate.getTime() - openDate.getTime() : 0;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    return [
      trade.id,
      trade.pair,
      trade.is_short ? 'SHORT' : 'LONG',
      trade.leverage || 1,
      format(openDate, 'yyyy-MM-dd HH:mm:ss'),
      closeDate ? format(closeDate, 'yyyy-MM-dd HH:mm:ss') : '',
      trade.open_rate,
      trade.close_rate ?? '',
      trade.stake_amount ?? '',
      trade.amount ?? '',
      trade.close_profit !== undefined ? (trade.close_profit * 100).toFixed(4) : '',
      trade.close_profit_abs ?? '',
      trade.exit_reason ?? '',
      closeDate ? durationMinutes : '',
    ].map(val => {
      // Escape values that contain commas or quotes
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface BotTradesProps {
  botId: string;
}

type TradeFilter = 'all' | 'open' | 'closed';

const ITEMS_PER_PAGE = 20;

export function BotTrades({ botId }: BotTradesProps) {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const [sortBy, setSortBy] = useState<'date' | 'profit'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: trades, isLoading, error } = useQuery({
    queryKey: ['bot', botId, 'trades', filter],
    queryFn: async (): Promise<Trade[]> => {
      const params = filter !== 'all' ? `?is_open=${filter === 'open'}` : '';
      const response = await api.get<Trade[]>(`/bots/${botId}/trades${params}`);
      return response.data;
    },
    enabled: !!botId,
    refetchInterval: 30000,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    if (!trades || trades.length === 0) return null;

    const closedTrades = trades.filter(t => !t.is_open);
    const openTrades = trades.filter(t => t.is_open);
    const winningTrades = closedTrades.filter(t => (t.close_profit ?? 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.close_profit ?? 0) < 0);

    const totalProfit = closedTrades.reduce((sum, t) => sum + (t.close_profit_abs ?? 0), 0);
    const avgProfit = closedTrades.length > 0
      ? closedTrades.reduce((sum, t) => sum + (t.close_profit ?? 0), 0) / closedTrades.length * 100
      : 0;
    const winRate = closedTrades.length > 0
      ? (winningTrades.length / closedTrades.length) * 100
      : 0;
    const avgWin = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (t.close_profit ?? 0), 0) / winningTrades.length * 100
      : 0;
    const avgLoss = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (t.close_profit ?? 0), 0) / losingTrades.length * 100
      : 0;

    // Best and worst trade
    const bestTrade = closedTrades.length > 0
      ? closedTrades.reduce((best, t) => (t.close_profit ?? 0) > (best.close_profit ?? 0) ? t : best)
      : null;
    const worstTrade = closedTrades.length > 0
      ? closedTrades.reduce((worst, t) => (t.close_profit ?? 0) < (worst.close_profit ?? 0) ? t : worst)
      : null;

    return {
      total: trades.length,
      open: openTrades.length,
      closed: closedTrades.length,
      wins: winningTrades.length,
      losses: losingTrades.length,
      winRate,
      totalProfit,
      avgProfit,
      avgWin,
      avgLoss,
      bestTrade,
      worstTrade,
    };
  }, [trades]);

  const sortedTrades = useMemo(() => {
    if (!trades) return [];
    return trades.slice().sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.close_date || a.open_date).getTime();
        const dateB = new Date(b.close_date || b.open_date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const profitA = a.close_profit_abs ?? 0;
        const profitB = b.close_profit_abs ?? 0;
        return sortOrder === 'asc' ? profitA - profitB : profitB - profitA;
      }
    });
  }, [trades, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil((sortedTrades?.length || 0) / ITEMS_PER_PAGE);
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedTrades.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedTrades, currentPage]);

  // Reset page when filter changes
  const handleFilterChange = (newFilter: TradeFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleExport = useCallback(() => {
    if (!sortedTrades || sortedTrades.length === 0) return;
    const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
    const filterSuffix = filter !== 'all' ? `_${filter}` : '';
    exportTradesToCSV(sortedTrades, `trades_${botId}${filterSuffix}_${timestamp}.csv`);
  }, [sortedTrades, botId, filter]);

  const toggleSort = (column: 'date' | 'profit') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400">
          Не удалось загрузить сделки. Этот бот может не поддерживать получение сделок этим способом.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Все
          </button>
          <button
            onClick={() => handleFilterChange('open')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'open'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Открытые
          </button>
          <button
            onClick={() => handleFilterChange('closed')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'closed'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Закрытые
          </button>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {sortedTrades?.length || 0} сделок
          </p>
          {sortedTrades && sortedTrades.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Экспорт сделок в CSV"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Экспорт CSV
            </button>
          )}
        </div>
      </div>

      {/* Statistics Panel */}
      {stats && stats.closed > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Винрейт</p>
            <p className={`text-lg font-semibold ${stats.winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {stats.winRate.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400">{stats.wins}W / {stats.losses}L</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Общая прибыль</p>
            <p className={`text-lg font-semibold ${stats.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {stats.totalProfit >= 0 ? '+' : ''}{stats.totalProfit.toFixed(4)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Средняя прибыль</p>
            <p className={`text-lg font-semibold ${stats.avgProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {stats.avgProfit >= 0 ? '+' : ''}{stats.avgProfit.toFixed(2)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Средний плюс</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              +{stats.avgWin.toFixed(2)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Средний минус</p>
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">
              {stats.avgLoss.toFixed(2)}%
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Открытые</p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {stats.open}
            </p>
          </div>
        </div>
      )}

      {/* Best/Worst Trade */}
      {stats && (stats.bestTrade || stats.worstTrade) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.bestTrade && (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">Лучшая сделка</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-medium text-gray-900 dark:text-white">{stats.bestTrade.pair}</span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  +{((stats.bestTrade.close_profit ?? 0) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
          {stats.worstTrade && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Худшая сделка</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-medium text-gray-900 dark:text-white">{stats.worstTrade.pair}</span>
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {((stats.worstTrade.close_profit ?? 0) * 100).toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trades Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
          ))}
        </div>
      ) : sortedTrades && sortedTrades.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="px-4 py-3">Пара</th>
                <th className="px-4 py-3">Сторона</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => toggleSort('date')}
                >
                  Дата
                  {sortBy === 'date' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-4 py-3">Вход</th>
                <th className="px-4 py-3">Выход</th>
                <th
                  className="px-4 py-3 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={() => toggleSort('profit')}
                >
                  Прибыль
                  {sortBy === 'profit' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
                <th className="px-4 py-3">Длительность</th>
                <th className="px-4 py-3">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedTrades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Показано {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, sortedTrades.length)} из {sortedTrades.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Первая
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Назад
                </button>
                <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Вперед
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Последняя
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Сделок нет</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {filter === 'open' ? 'Нет открытых позиций.' : filter === 'closed' ? 'Закрытых сделок пока нет.' : 'Для этого бота сделки не найдены.'}
          </p>
        </div>
      )}
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const isProfit = (trade.close_profit ?? 0) >= 0;
  const openDate = new Date(trade.open_date);
  const closeDate = trade.close_date ? new Date(trade.close_date) : null;

  // Calculate duration
  let duration = '-';
  if (closeDate) {
    const diffMs = closeDate.getTime() - openDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      duration = `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      duration = `${diffHours}h ${diffMins % 60}m`;
    } else {
      duration = `${diffMins}m`;
    }
  } else {
    // Open trade - show time open
    const now = new Date();
    const diffMs = now.getTime() - openDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      duration = `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
      duration = `${diffHours}h ${diffMins % 60}m`;
    } else {
      duration = `${diffMins}m`;
    }
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-white">{trade.pair}</span>
          {trade.leverage > 1 && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
              {trade.leverage}x
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-1 rounded font-medium ${
          trade.is_short
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
        }`}>
          {trade.is_short ? 'ШОРТ' : 'ЛОНГ'}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {openDate.toLocaleDateString()} {openDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
        {trade.open_rate.toFixed(trade.open_rate < 1 ? 6 : 2)}
      </td>
      <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
        {trade.close_rate?.toFixed(trade.close_rate < 1 ? 6 : 2) || '-'}
      </td>
      <td className="px-4 py-3">
        {trade.close_profit !== undefined ? (
          <div className={`text-sm font-medium ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {isProfit ? '+' : ''}{(trade.close_profit * 100).toFixed(2)}%
            {trade.close_profit_abs !== undefined && (
              <span className="block text-xs opacity-75">
                {isProfit ? '+' : ''}{trade.close_profit_abs.toFixed(4)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {duration}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-1 rounded font-medium ${
          trade.is_open
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}>
          {trade.is_open ? 'Открыта' : trade.exit_reason || 'Закрыта'}
        </span>
      </td>
    </tr>
  );
}
