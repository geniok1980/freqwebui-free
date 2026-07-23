import {
  PortfolioSummary,
  ExchangeBreakdown,
  StrategyBreakdown,
  TopPerformersChart,
} from '../components/Portfolio';
import { BotGrid, BotFilters } from '../components/Dashboard';
import { useTranslation } from 'react-i18next';

export function Dashboard() {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      {/* Portfolio Summary */}
      <section>
        <PortfolioSummary />
      </section>

      {/* Performance Charts */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TopPerformersChart />
        <div className="grid grid-cols-1 gap-6">
          <ExchangeBreakdown />
          <StrategyBreakdown />
        </div>
      </section>

      {/* Bot Grid Section */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('nav.bots')}
        </h2>
        <BotFilters />
        <BotGrid />
      </section>
    </div>
  );
}
