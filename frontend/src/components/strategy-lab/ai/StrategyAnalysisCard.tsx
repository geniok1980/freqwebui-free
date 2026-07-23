import type { StrategyAnalysisResult } from '../../../services/strategyLabAiApi';
import { useTranslation } from 'react-i18next';

interface StrategyAnalysisCardProps {
  analysis: StrategyAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

export function StrategyAnalysisCard({ analysis, isLoading, error }: StrategyAnalysisCardProps) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200">
        AI анализирует стратегию...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
        {error}
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-violet-200 bg-violet-50/80 px-4 py-4 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Источник: {analysis.source}</span>
        {analysis.model && <span>Модель: {analysis.model}</span>}
        <span>Сгенерировано: {new Date(analysis.generated_at).toLocaleString()}</span>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
          {analysis.warnings.join(' ')}
        </div>
      )}

      <div className="whitespace-pre-wrap text-sm leading-6 text-gray-800 dark:text-gray-100">
        {analysis.analysis}
      </div>
    </div>
  );
}
