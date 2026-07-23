import type { OptimizationRun } from '../../../services/strategyLabApi';
import type { RunAnalysisResult } from '../../../services/strategyLabAiApi';
import { Card } from '../../common/Card';
import { useTranslation } from 'react-i18next';

interface BacktestAnalysisCardProps {
  run: OptimizationRun | null;
  analysis: RunAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
}

export function BacktestAnalysisCard({
  run,
  analysis,
  isLoading,
  error,
  onAnalyze,
}: BacktestAnalysisCardProps) {
  const { t } = useTranslation();
  if (!run) {
    return null;
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI-анализ выбранного прогона
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {run.strategy_name} · {run.process_type} · {new Date(run.started_at).toLocaleString()}
          </p>
        </div>
        <button
          onClick={onAnalyze}
          disabled={isLoading}
          className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-400"
        >
          {isLoading ? 'Анализируем...' : 'Запустить AI-анализ'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <p className="text-gray-500 dark:text-gray-400">Прибыль</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {run.result_profit_pct !== undefined && run.result_profit_pct !== null
              ? `${run.result_profit_pct >= 0 ? '+' : ''}${run.result_profit_pct.toFixed(2)}%`
              : '--'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <p className="text-gray-500 dark:text-gray-400">Просадка</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {run.result_drawdown !== undefined && run.result_drawdown !== null
              ? `${run.result_drawdown.toFixed(2)}%`
              : '--'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <p className="text-gray-500 dark:text-gray-400">Сделки</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {run.result_trade_count ?? '--'}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50">
          <p className="text-gray-500 dark:text-gray-400">Статус</p>
          <p className="font-medium text-gray-900 dark:text-white">{run.status}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {error}
        </div>
      )}

      {analysis && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Источник: {analysis.source}</span>
            {analysis.model && <span>Модель: {analysis.model}</span>}
            <span>Сгенерировано: {new Date(analysis.generated_at).toLocaleString()}</span>
          </div>

          {analysis.warnings.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
              {analysis.warnings.join(' ')}
            </div>
          )}

          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-4 text-sm leading-6 whitespace-pre-wrap text-gray-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-gray-100">
            {analysis.analysis}
          </div>
        </div>
      )}

      {!analysis && !error && !isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Нажмите кнопку, чтобы получить AI-разбор этого результата через Mastra.
        </p>
      )}
    </Card>
  );
}
