import { useStrategyBreakdown } from '../../hooks/usePortfolio';
import { useTranslation } from 'react-i18next';

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function StrategyBreakdown() {
  const { t } = useTranslation();
  const { data: breakdowns, isLoading, isError } = useStrategyBreakdown();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !breakdowns) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-red-500">{t('portfolio.strategyBreakdownFailed')}</p>
      </div>
    );
  }

  if (breakdowns.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          By Strategy
        </h3>
        <p className="text-gray-500 dark:text-gray-400">{t('portfolio.noData')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        By Strategy
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Strategy
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bots
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Profit
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Trades
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Win Rate
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {breakdowns.map((strategy) => {
              const profitColor =
                strategy.profit_abs >= 0 ? 'text-green-600' : 'text-red-600';

              return (
                <tr key={strategy.strategy}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    <span className="truncate max-w-xs block" title={strategy.strategy}>
                      {strategy.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {strategy.bot_count}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${profitColor}`}>
                    {formatNumber(strategy.profit_abs)} USDT
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {strategy.closed_trades}
                    {strategy.open_positions > 0 && (
                      <span className="text-xs text-blue-500 ml-1">
                        +{strategy.open_positions} open
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {strategy.win_rate
                      ? `${formatNumber(strategy.win_rate * 100)}%`
                      : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
