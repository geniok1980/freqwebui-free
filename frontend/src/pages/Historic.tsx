/**
 * Historic page for viewing historical bot data from analytics database.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { format } from 'date-fns';

function parseUtcNaiveTimestamp(ts: string): Date {
  // Backend/DB may return "YYYY-MM-DD HH:MM:SS" without timezone.
  // Treat it as UTC to avoid 1h drift, then format explicitly to Europe/Vienna.
  const s = ts.trim();
  if (s.endsWith('Z') || /[+-]\d\d:\d\d$/.test(s)) {
    return new Date(s);
  }
  // Support "YYYY-MM-DD HH:MM[:SS[.fff]]" by converting space to 'T' and appending Z.
  return new Date(s.replace(' ', 'T') + 'Z');
}

function formatVienna(ts: string | undefined | null): string {
  if (!ts) return '-';
  const d = parseUtcNaiveTimestamp(ts);
  // "sv-SE" gives ISO-like output: YYYY-MM-DD HH:mm
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Vienna',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface BotSnapshot {
  bot_name: string;
  timestamp: string;
  profit_all: number | string;
  profit_closed: number | string;
  winrate: number | string;
  trade_count: number;
  open_trades: number;
  balance: number | string;
  stake_currency?: string;
}

interface BotInfo {
  name: string;
  last_seen: string;
  snapshot_count: number;
  is_active: boolean;
}

interface BotSeriesPoint {
  timestamp: string;
  profit_all: number;
  winrate: number;
  balance: number;
  trade_count: number;
}

export function Historic() {
  const [selectedBot, setSelectedBot] = useState<string | null>(null);

  // Fetch list of bots with historic data (V4: includes all bots with activity status)
  const { data: botsData, isLoading: botsLoading } = useQuery({
    queryKey: ['historic', 'bots'],
    queryFn: async () => {
      const response = await api.get<{ bots: BotInfo[] }>('/historic/bots');
      return response.data?.bots || [];
    },
  });

  // Fetch latest snapshot for all bots
  const { data: snapshots, isLoading: snapshotsLoading } = useQuery({
    queryKey: ['historic', 'snapshots'],
    queryFn: async () => {
      if (!botsData?.length) return [];
      const promises = botsData.map(async (bot) => {
        try {
          const response = await api.get<BotSnapshot>(`/historic/bot/${encodeURIComponent(bot.name)}/latest`);
          return response.data;
        } catch (e) {
          return null;
        }
      });
      const results = await Promise.all(promises);
      return results.filter((s): s is BotSnapshot => s !== null);
    },
    enabled: !!botsData?.length,
  });

  // Fetch time series for selected bot
  const { data: seriesData } = useQuery({
    queryKey: ['historic', 'series', selectedBot],
    queryFn: async () => {
      if (!selectedBot) return null;
      const response = await api.get<{ bot_name: string; points: BotSeriesPoint[] }>(
        `/historic/bot/${encodeURIComponent(selectedBot)}/series?limit=100`
      );
      return response.data;
    },
    enabled: !!selectedBot,
  });

  const formatProfit = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}`;
  };

  const formatWinrate = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '-';
    // V4 Fix: DB stores winrate as percentage (75.0 = 75%), don't multiply by 100
    return `${num.toFixed(1)}%`;
  };

  const chartData = seriesData?.points
    ?.slice()
    ?.reverse()
    ?.map((p) => ({
      ...p,
      time: format(new Date(p.timestamp), 'MM-dd HH:mm'),
    })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Исторические данные
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Из Analytics DB (localhost)
        </span>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Всего ботов</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {botsData?.length || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Всего сделок</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {snapshots?.reduce((acc, s) => acc + (s.trade_count || 0), 0) || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Открытые сделки</p>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {snapshots?.reduce((acc, s) => acc + (s.open_trades || 0), 0) || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Общая прибыль</p>
          <p className={`text-2xl font-bold ${
            (snapshots?.reduce((acc, s) => acc + Number(s.profit_all || 0), 0) || 0) >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {formatProfit(snapshots?.reduce((acc, s) => acc + Number(s.profit_all || 0), 0) || 0)}
          </p>
        </div>
      </div>

      {/* Bot List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Снимки ботов
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Бот
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Последнее обновление
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Прибыль общая
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Winrate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Сделки
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Open
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Действие
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {botsLoading || snapshotsLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Загрузка...
                  </td>
                </tr>
              ) : !snapshots?.length ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                    Исторические данные отсутствуют. Убедитесь, что analytics pipeline запущен.
                  </td>
                </tr>
              ) : (
                snapshots.map((snapshot) => {
                  // V4: Find bot info to show status
                  const botInfo = botsData?.find(b => b.name === snapshot.bot_name);
                  return (
                  <tr
                    key={snapshot.bot_name}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                      selectedBot === snapshot.bot_name ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    } ${!botInfo?.is_active ? 'opacity-60' : ''}`}
                    onClick={() => setSelectedBot(snapshot.bot_name)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {snapshot.bot_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {botInfo?.is_active ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          ● Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          ○ Неактивен
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatVienna(snapshot.timestamp)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      Number(snapshot.profit_all || 0) >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {formatProfit(snapshot.profit_all)} {snapshot.stake_currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {formatWinrate(snapshot.winrate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {snapshot.trade_count || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (snapshot.open_trades || 0) > 0
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {snapshot.open_trades || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                      {formatProfit(snapshot.balance)} {snapshot.stake_currency || 'USDT'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <button
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBot(snapshot.bot_name);
                        }}
                      >
                        Показать график
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart Section */}
      {selectedBot && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedBot} - История прибыли
            </h2>
            <button
              onClick={() => setSelectedBot(null)}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Закрыть
            </button>
          </div>

          {!seriesData ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Загрузка данных графика...
            </div>
          ) : !chartData.length ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Нет данных графика
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis
                    dataKey="time"
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(v) => `${typeof v === 'string' ? parseFloat(v).toFixed(0) : v.toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    formatter={(value: number) => [formatProfit(value), 'Прибыль']}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit_all"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#profitGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Winrate Chart */}
          {chartData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                История винрейта
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                    <XAxis
                      dataKey="time"
                      stroke="#6B7280"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#6B7280"
                      fontSize={12}
                      tickLine={false}
                      domain={[0, 1]}
                      tickFormatter={(v) => `${((typeof v === 'string' ? parseFloat(v) : v) * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#9CA3AF' }}
                      formatter={(value: number) => [formatWinrate(value), 'Винрейт']}
                    />
                    <Line
                      type="monotone"
                      dataKey="winrate"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
          О разделе Исторические данные
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Эти данные приходят из analytics database (localhost), где хранятся исторические
          снимки ваших торговых ботов. Конвейер запускается каждые 5 минут и сохраняет метрики.
          Нажмите на строку бота или «Показать график», чтобы увидеть историю прибыли/винрейта.
        </p>
      </div>
    </div>
  );
}
