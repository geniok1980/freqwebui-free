import { usePortfolioSummary } from '../../hooks/usePortfolio';
import { useTranslation } from 'react-i18next';

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPercent(num: number): string {
  return `${num >= 0 ? '+' : ''}${formatNumber(num)}%`;
}

export function PortfolioSummary() {
  const { t } = useTranslation();
  const { data: summary, isLoading, isError } = usePortfolioSummary();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-red-500">Failed to load portfolio summary</p>
      </div>
    );
  }

  const profitColor =
    (summary.total_profit_abs || 0) >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Portfolio Overview
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Profit */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('portfolio.totalProfit')}</p>
          <p className={`text-2xl font-bold ${profitColor}`}>
            {formatNumber(summary.total_profit_abs || 0)} USDT
          </p>
          <p className={`text-sm ${profitColor}`}>
            {formatPercent(summary.total_profit_pct || 0)}
          </p>
        </div>

        {/* Total Balance */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('portfolio.totalBalance')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(summary.total_balance || 0)} USDT
          </p>
        </div>

        {/* Open Positions */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('portfolio.openPositions')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.total_open_positions || 0}
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('portfolio.avgWinRate')}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {summary.avg_win_rate
              ? `${formatNumber(summary.avg_win_rate * 100)}%`
              : 'N/A'}
          </p>
        </div>

        {/* Bot Health Status */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 col-span-2">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            Trading Bots ({summary.portfolio_bots || 0} with data)
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-gray-900 dark:text-white">
                {summary.healthy_bots || 0} Online
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
              <span className="text-gray-900 dark:text-white">
                {summary.unreachable_bots || 0} Offline
              </span>
            </div>
            {((summary.hyperopt_bots || 0) > 0 || (summary.backtest_bots || 0) > 0) && (
              <>
                <div className="border-l border-gray-300 dark:border-gray-600 pl-4 flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    {summary.hyperopt_bots || 0} Hyperopt
                  </span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">
                    {summary.backtest_bots || 0} Backtest
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Best/Worst Performers */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('portfolio.bestPerformer')}</p>
          <p className="text-lg font-medium text-green-600">
            {summary.best_performer || 'N/A'}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('portfolio.worstPerformer')}</p>
          <p className="text-lg font-medium text-red-600">
            {summary.worst_performer || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
}
