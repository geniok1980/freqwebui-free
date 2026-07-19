/**
 * Comparison Page — Backtest ↔ Dry-Run ↔ Live (уроки 16, 20, 23).
 * Сравнивает производительность стратегии в трёх режимах.
 */

import {useQuery} from '@tanstack/react-query';
import {api} from '../services/api';

// ── Types ──

interface ModeData {
  profit_pct: number | null;
  total_trades: number | null;
  win_rate: number | null;
  max_drawdown: number | null;
  avg_profit_pct?: number | null;
  sharpe?: number | null;
  profit_factor?: number | null;
  calmar?: number | null;
  total_profit_abs?: number | null;
  bot_name?: string;
}

interface ToleranceCheck {
  backtest: number;
  live: number;
  within_tolerance: boolean;
  status: string;
  diff_pct?: number;
  ratio?: number;
}

interface ComparisonRow {
  strategy_name: string;
  timeframe: string | null;
  timerange: string | null;
  backtest_date: string | null;
  backtest: ModeData | null;
  dry_run: ModeData | null;
  live: ModeData | null;
  tolerances: Record<string, ToleranceCheck>;
}

// ── Format helpers ──

const fmtPct = (v: number | null | undefined): string =>
  v !== null && v !== undefined ? (v * 100).toFixed(2) + '%' : '—';

const fmtNum = (v: number | null | undefined): string =>
  v !== null && v !== undefined ? v.toFixed(v < 10 ? 2 : 1) : '—';

const fmtInt = (v: number | null | undefined): string =>
  v !== null && v !== undefined ? String(Math.round(v)) : '—';

// ── Status badge ──

function ToleranceBadge({tol}: {tol: ToleranceCheck}) {
  if (!tol || tol.within_tolerance) {
    return <span className="text-xs text-green-600 dark:text-green-400 font-medium">✅</span>;
  }
  return <span className="text-xs text-red-600 dark:text-red-400 font-medium">⚠️</span>;
}

function ToleranceNote({tol}: {tol: ToleranceCheck}) {
  if (!tol) return null;
  if (tol.within_tolerance) return null;
  const detail = tol.diff_pct !== undefined
    ? `отклонение ${tol.diff_pct.toFixed(1)}%`
    : tol.ratio !== undefined
      ? `коэф. ${tol.ratio.toFixed(2)}x`
      : '';
  return <span className="text-[10px] text-red-500 block">{detail}</span>;
}

// ── Metric cell ──

function Cell({
  bt, dr, lv,
  fmt = fmtPct,
  tolBt,
  tolDr,
}: {
  bt: number | null | undefined;
  dr?: number | null | undefined;
  lv?: number | null | undefined;
  fmt?: (v: any) => string;
  tolBt?: ToleranceCheck;
  tolDr?: ToleranceCheck;
}) {
  return (
    <>
      <td className="px-3 py-2 text-sm text-center font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800/50">
        {fmt(bt)}
      </td>
      <td className={`px-3 py-2 text-sm text-center font-mono ${dr !== undefined && dr !== null ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}`}>
        {fmt(dr)}
        {tolDr && <ToleranceNote tol={tolDr} />}
      </td>
      <td className={`px-3 py-2 text-sm text-center font-mono ${lv !== undefined && lv !== null ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}`}>
        <div className="flex items-center justify-center gap-1">
          {fmt(lv)}
          {tolBt && <ToleranceBadge tol={tolBt} />}
        </div>
        {tolBt && <ToleranceNote tol={tolBt} />}
      </td>
    </>
  );
}

// ── Strategy comparison table ──

function StrategyTable({row}: {row: ComparisonRow}) {
  const t = row.tolerances;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{row.strategy_name}</h2>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {row.timeframe && <span>⏱ {row.timeframe}</span>}
              {row.timerange && <span>📅 {row.timerange}</span>}
              {row.backtest_date && <span>🕐 {new Date(row.backtest_date).toLocaleDateString()}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {row.backtest && (
              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                📉 Backtest
              </span>
            )}
            {row.dry_run && (
              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                🧪 Dry-Run
              </span>
            )}
            {row.live && (
              <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                🔴 Live
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-48">
                Метрика
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider w-28">
                📉 Backtest
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider w-28">
                🧪 Dry-Run
              </th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider w-28">
                🔴 Live
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Доходность %
              </td>
              <Cell
                bt={row.backtest?.profit_pct}
                dr={row.dry_run?.profit_pct}
                lv={row.live?.profit_pct}
                tolBt={t?.profit_pct_live}
                tolDr={t?.profit_pct_dr}
              />
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Win Rate %
              </td>
              <Cell
                bt={row.backtest?.win_rate}
                dr={row.dry_run?.win_rate}
                lv={row.live?.win_rate}
                tolBt={t?.win_rate_live}
                tolDr={t?.win_rate_dr}
              />
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Макс. просадка %
              </td>
              <Cell
                bt={row.backtest?.max_drawdown}
                dr={row.dry_run?.max_drawdown}
                lv={row.live?.max_drawdown}
                tolBt={t?.max_drawdown_live}
                tolDr={t?.max_drawdown_dr}
              />
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Всего сделок
              </td>
              <Cell
                bt={row.backtest?.total_trades}
                dr={row.dry_run?.total_trades}
                lv={row.live?.total_trades}
                fmt={fmtInt}
              />
            </tr>
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
              <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                Средняя прибыль/сделку
              </td>
              <Cell
                bt={row.backtest?.avg_profit_pct}
                dr={row.dry_run?.avg_profit_pct}
                lv={row.live?.avg_profit_pct}
                tolBt={t?.avg_profit_pct_live}
                tolDr={t?.avg_profit_pct_dr}
              />
            </tr>
            {row.backtest?.sharpe !== undefined && (
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sharpe Ratio
                </td>
                <Cell bt={row.backtest?.sharpe} fmt={fmtNum} />
                <td className="px-3 py-2 text-sm text-center text-gray-400">—</td>
                <td className="px-3 py-2 text-sm text-center text-gray-400">—</td>
              </tr>
            )}
            {row.backtest?.profit_factor !== undefined && (
              <tr className="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td className="px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Profit Factor
                </td>
                <Cell bt={row.backtest?.profit_factor} fmt={fmtNum} />
                <td className="px-3 py-2 text-sm text-center text-gray-400">—</td>
                <td className="px-3 py-2 text-sm text-center text-gray-400">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tolerance legend */}
      {Object.keys(t).length > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Допустимые отклонения (урок 22):</span>
            <span>📉 Доходность ±50%</span>
            <span>📊 Win Rate ±15%</span>
            <span>📉 Просадка ≤1.5x</span>
            <span>💰 Средняя прибыль ±50%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ──

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">⚖️</div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Нет данных для сравнения
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        Для отображения сравнения необходим хотя бы один бот с метриками
        или импортированные результаты бэктеста.
      </p>
    </div>
  );
}

// ── Main component ──

export function ComparisonView() {
  const {data: rows, isLoading, error} = useQuery({
    queryKey: ['comparison'],
    queryFn: async () => {
      const res = await api.get<ComparisonRow[]>('/comparison');
      return res?.data ?? [];
    },
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="text-red-600 dark:text-red-400">Ошибка: {(error as Error).message}</p>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return <EmptyState />;
  }

  const hasLive = rows.some(r => r.live);
  const hasDryRun = rows.some(r => r.dry_run);
  const hasBacktest = rows.some(r => r.backtest);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            ⚖️ Backtest ↔ Dry-Run ↔ Live
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Сравнение производительности стратегии в трёх режимах — уроки 16, 20, 23
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {hasBacktest && <span className="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">📉 Есть бэктест</span>}
 {hasDryRun && <span className="px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">🧪 Есть dry-run</span>}
 {hasLive && <span className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">🔴 Есть live</span>}
        </div>
      </div>

      {/* Note */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 text-sm text-blue-700 dark:text-blue-300">
        <strong>Допустимые расхождения</strong> (из урока 22): доходность ±50%, win rate ±15%, макс. просадка ≤1.5x, средняя прибыль ±50%.
        Если отклонение выходит за пределы — стратегия требует внимания.
      </div>

      {/* Tables */}
      <div className="space-y-6">
        {rows.map((row, i) => (
          <StrategyTable key={row.strategy_name + '-' + i} row={row} />
        ))}
      </div>
    </div>
  );
}
