import { Link } from 'react-router-dom';
import type { Bot } from '../../types';
import { StatusIndicator } from '../common/StatusIndicator';
import { getEnvironmentColor, getProfitColor } from '../../styles/theme';
import { useBotMetrics } from '../../hooks/useBots';
import { SparklineChart } from './SparklineChart';

/**
 * Convert bot API URL to use current browser hostname instead of localhost.
 */
function getFreqUIUrl(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const url = new URL(apiUrl);
    // Replace localhost/127.0.0.1 with current browser hostname
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return apiUrl;
  }
}

interface BotCardProps {
  bot: Bot;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function BotCard({ bot, isExpanded, onToggleExpand }: BotCardProps) {
  const { data: metrics, isLoading: metricsLoading } = useBotMetrics(bot.id);

  const profitValue = metrics?.profit_abs ?? 0;
  const profitColor = getProfitColor(profitValue);
  const envColor = getEnvironmentColor(bot.environment);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StatusIndicator status={bot.health_state} size="lg" pulse />
            <div>
              <Link
                to={`/bots/${bot.id}`}
                className="text-lg font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
              >
                {bot.name}
              </Link>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${envColor}`}
                >
                  {bot.environment}
                </span>
                {bot.is_dryrun && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">
                    Демо
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* FreqUI Direct Link */}
            {getFreqUIUrl(bot.api_url) && (
              <a
                href={getFreqUIUrl(bot.api_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="Открыть FreqUI"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Mobile expand button */}
            <button
              onClick={onToggleExpand}
              className="lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className={`w-5 h-5 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className={`p-4 ${isExpanded ? 'block' : 'hidden lg:block'}`}>
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Profit */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Прибыль</p>
            {metricsLoading ? (
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className={`text-lg font-semibold ${profitColor}`}>
                {profitValue >= 0 ? '+' : ''}
                {formatNumber(profitValue)} USDT
              </p>
            )}
          </div>

          {/* Win Rate */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Винрейт</p>
            {metricsLoading ? (
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {metrics?.win_rate
                  ? `${formatNumber(metrics.win_rate * 100)}%`
                  : 'Н/Д'}
              </p>
            )}
          </div>

          {/* Open Positions */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Позиции</p>
            {metricsLoading ? (
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {metrics?.open_positions ?? 0}
              </p>
            )}
          </div>

          {/* Trades */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Сделки</p>
            {metricsLoading ? (
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {metrics?.closed_trades ?? 0}
              </p>
            )}
          </div>
        </div>

        {/* Mini Chart */}
        <div className="h-12 mb-4">
          <SparklineChart botId={bot.id} />
        </div>

        {/* Tags & Info */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
          {bot.exchange && (
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {bot.exchange}
            </span>
          )}
          {bot.strategy && (
            <span
              className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded truncate max-w-[120px]"
              title={bot.strategy}
            >
              {bot.strategy}
            </span>
          )}
          {bot.tags.map((tag) => (
            <span
              key={tag}
              className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Data source indicator */}
        {metrics && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <span
              className={`text-xs ${
                metrics.data_source === 'api'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}
            >
              Данные: {metrics.data_source.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Card Footer - Quick Actions */}
      <div
        className={`px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-b-lg flex justify-between items-center ${
          isExpanded ? 'block' : 'hidden lg:flex'
        }`}
      >
        <Link
          to={`/bots/${bot.id}`}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Детали
        </Link>
        {bot.last_seen && (
          <span className="text-xs text-gray-400">
            Последняя активность: {new Date(bot.last_seen).toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna' })}
          </span>
        )}
      </div>
    </div>
  );
}
