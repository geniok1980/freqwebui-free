/**
 * Bot overview component showing key metrics and stats.
 */

import { useTranslation } from 'react-i18next';
import type { Bot, BotMetrics } from '../../types';

interface BotOverviewProps {
  bot: Bot & {
    container_id?: string;
    user_data_path?: string;
    discovered_at: string;
    created_at: string;
  };
  metrics?: BotMetrics;
  isLoading: boolean;
}

function MetricCard({
  label,
  value,
  suffix,
  trend,
  loading,
}: {
  label: string;
  value: string | number | undefined;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse mb-2"></div>
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
      </div>
    );
  }

  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-900 dark:text-white',
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${trendColors[trend || 'neutral']}`}>
        {value !== undefined ? value : '-'}
        {suffix && <span className="text-base font-normal ml-1">{suffix}</span>}
      </p>
    </div>
  );
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}

export function BotOverview({ bot, metrics, isLoading }: BotOverviewProps) {
  const { t } = useTranslation();
  const profitTrend = metrics?.profit_pct !== undefined
    ? metrics.profit_pct >= 0 ? 'up' : 'down'
    : 'neutral';

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Performance Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Total Profit"
            value={metrics?.profit_pct?.toFixed(2)}
            suffix="%"
            trend={profitTrend}
            loading={isLoading}
          />
          <MetricCard
            label="Profit (Absolute)"
            value={metrics?.profit_abs?.toFixed(4)}
            trend={profitTrend}
            loading={isLoading}
          />
          <MetricCard
            label="Win Rate"
            value={metrics?.win_rate !== undefined ? (metrics.win_rate * 100).toFixed(1) : undefined}
            suffix="%"
            loading={isLoading}
          />
          <MetricCard
            label="Balance"
            value={metrics?.balance?.toFixed(2)}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Trading Stats */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Trading Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Open Positions"
            value={metrics?.open_positions}
            loading={isLoading}
          />
          <MetricCard
            label="Closed Trades"
            value={metrics?.closed_trades}
            loading={isLoading}
          />
          <MetricCard
            label="Realized Profit"
            value={metrics?.profit_realized?.toFixed(4)}
            trend={metrics?.profit_realized !== undefined
              ? metrics.profit_realized >= 0 ? 'up' : 'down'
              : 'neutral'}
            loading={isLoading}
          />
          <MetricCard
            label="Unrealized P/L"
            value={metrics?.profit_unrealized?.toFixed(4)}
            trend={metrics?.profit_unrealized !== undefined
              ? metrics.profit_unrealized >= 0 ? 'up' : 'down'
              : 'neutral'}
            loading={isLoading}
          />
        </div>
      </div>

      {/* Bot Details */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Bot Information
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
          <dl className="divide-y divide-gray-200 dark:divide-gray-600">
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.environment')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2 capitalize">{bot.environment}</dd>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.exchange')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2">{bot.exchange || '-'}</dd>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.strategy')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2">{bot.strategy || '-'}</dd>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.tradingMode')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2 capitalize">
                {bot.trading_mode || '-'}
                {bot.is_dryrun && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                    Dry Run
                  </span>
                )}
              </dd>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.dataSource')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2 capitalize">
                {metrics?.data_source || bot.source_mode}
              </dd>
            </div>
            {bot.host && (
              <div className="px-4 py-3 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.host')}</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono">{bot.host}</dd>
              </div>
            )}
            {bot.api_url && (
              <div className="px-4 py-3 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.apiUrl')}</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono">{bot.api_url}</dd>
              </div>
            )}
            {bot.container_id && (
              <div className="px-4 py-3 grid grid-cols-3 gap-4">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.containerId')}</dt>
                <dd className="text-sm text-gray-900 dark:text-white col-span-2 font-mono">
                  {bot.container_id.substring(0, 12)}
                </dd>
              </div>
            )}
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.lastSeen')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2">
                {formatRelativeTime(bot.last_seen)} ({formatDate(bot.last_seen)})
              </dd>
            </div>
            <div className="px-4 py-3 grid grid-cols-3 gap-4">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('botOverview.discoveredAt')}</dt>
              <dd className="text-sm text-gray-900 dark:text-white col-span-2">{formatDate(bot.discovered_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
