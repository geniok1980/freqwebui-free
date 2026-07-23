import type { HyperoptRecommendationResult } from '../../../services/strategyLabAiApi';
import { Card } from '../../common/Card';
import { useTranslation } from 'react-i18next';

interface HyperoptRecommendationCardProps {
  strategyName: string;
  recommendation: HyperoptRecommendationResult | null;
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
}

export function HyperoptRecommendationCard({
  strategyName,
  recommendation,
  isLoading,
  error,
  onAnalyze,
}: HyperoptRecommendationCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI-рекомендации по Hyperopt
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {strategyName
              ? `AI разбирает сохраненные эпохи стратегии ${strategyName}`
              : 'Выберите стратегию, чтобы получить рекомендации по эпохам'}
          </p>
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={!strategyName || isLoading}
          className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-400"
        >
          {isLoading ? 'Анализируем...' : 'Получить рекомендации'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      )}

      {recommendation && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Источник: {recommendation.source}</span>
            {recommendation.model && <span>Модель: {recommendation.model}</span>}
            <span>Сгенерировано: {new Date(recommendation.generated_at).toLocaleString()}</span>
            <span>Эпох: {recommendation.epochs.length}</span>
          </div>

          {recommendation.warnings.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
              {recommendation.warnings.join(' ')}
            </div>
          )}

          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-4 text-sm leading-6 whitespace-pre-wrap text-gray-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-gray-100">
            {recommendation.analysis}
          </div>
        </div>
      )}

      {!recommendation && !error && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          После запуска AI появится краткий разбор эпох, рисков и рекомендуемого следующего шага.
        </p>
      )}
    </Card>
  );
}
