import { useExchangeBreakdown } from '../../hooks/usePortfolio';
import { useTranslation } from 'react-i18next';

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function ExchangeBreakdown() {
  const { t } = useTranslation();
  const { data: breakdowns, isLoading, isError } = useExchangeBreakdown();

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
        <p className="text-red-500">{t('portfolio.exchangeBreakdownFailed')}</p>
      </div>
    );
  }

  if (breakdowns.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          By Exchange
        </h3>
        <p className="text-gray-500 dark:text-gray-400">{t('portfolio.noData')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        By Exchange
      </h3>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Exchange
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Bots
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Profit
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Positions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {breakdowns.map((exchange) => {
              const profitColor =
                exchange.profit_abs >= 0 ? 'text-green-600' : 'text-red-600';

              return (
                <tr key={exchange.exchange}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {exchange.exchange}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {exchange.bot_count}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right ${profitColor}`}>
                    {formatNumber(exchange.profit_abs)} USDT
                    <span className="text-xs ml-1">
                      ({exchange.profit_pct >= 0 ? '+' : ''}
                      {formatNumber(exchange.profit_pct)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {formatNumber(exchange.balance)} USDT
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                    {exchange.open_positions}
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
