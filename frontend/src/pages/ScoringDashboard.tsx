/**
 * Scoring Dashboard — оценка стратегий по методологии курса (уроки 6, 13).
 *
 * 4 группы:
 *   Доходность (40%) — общая доходность, годовая, средняя на сделку
 *   Риск (30%) — просадка, Шарп, Калмар
 *   Стабильность (20%) — win rate, фактор прибыли, время удержания
 *   Эффективность (10%) — сделок/день, использование капитала
 *
 * Итог: взвешенный балл 0-10 → 0-100%.
 */

import {useQuery} from '@tanstack/react-query';
import {api} from '../services/api';
import { useTranslation } from 'react-i18next';

// ── Types ──

interface MetricItem {
  label: string;
  value: number | null;
  score: number;
  rating: string;
  weight_pct: number;
  detail?: string;
}

interface ScoringGroupData {
  name: string;
  weight_pct: number;
  total_weighted: number;
  metrics: MetricItem[];
}

interface BotScoringData {
  bot_id: string;
  bot_name: string;
  strategy: string | null;
  exchange: string | null;
  is_dry_run: boolean;
  timestamp: string;
  total_score: number;
  total_percent: number;
  groups: Record<string, ScoringGroupData>;
}

// ── Colour helpers ──

function scoreColor(score: number): string {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#84cc16';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}

function scoreBgClass(score: number): string {
  if (score >= 8) return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
  if (score >= 6) return 'bg-lime-100 dark:bg-lime-900/30 border-lime-300 dark:border-lime-700';
  if (score >= 4) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
  if (score >= 2) return 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700';
  return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
}

// ── Rating label ──

const RATING_EMOJI: Record<string, string> = {
  excellent: '🟢',
  good: '🟡',
  satisfactory: '🟠',
  poor: '🔴',
  'very poor': '🔴',
  dangerous: '⛔',
  'no data': '⚪',
};

const RATING_RU_TO_EN: Record<string, string> = {
  'Отлично': 'excellent',
  'Хорошо': 'good',
  'Удовл': 'satisfactory',
  'Плохо': 'poor',
  'Очень плохо': 'very poor',
  'Опасно': 'dangerous',
  'Нет данных': 'no data',
};

function translateRating(rating: string): string {
  return RATING_RU_TO_EN[rating] ?? rating;
}

// ── API ──

async function fetchScoring(): Promise<BotScoringData[]> {
  const res = await api.get<BotScoringData[]>('/scoring');
  return res?.data ?? [];
}

// ── Rating EN key → i18n key mapping ──

const RATING_EN_TO_I18N: Record<string, string> = {
  excellent: 'scoring.excellent',
  good: 'scoring.good',
  satisfactory: 'scoring.satisfactory',
  poor: 'scoring.poor',
  'very poor': 'scoring.dangerous',
  dangerous: 'scoring.dangerous',
  'no data': 'scoring.noData',
};

// ── Metric badge ──

function MetricBadge({metric}: {metric: MetricItem}) {
  const {t} = useTranslation();
  const enRating = translateRating(metric.rating);

  return (
    <div className={`rounded-lg border p-3 ${scoreBgClass(metric.score)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
          {metric.label}
        </span>
        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
          {t('scoring.weight')} {metric.weight_pct}%
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-lg font-bold" style={{color: scoreColor(metric.score)}}>
            {metric.value !== null ? metric.value.toFixed(metric.value < 10 ? 2 : 1) : '—'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {RATING_EMOJI[enRating] ?? ''} {t(RATING_EN_TO_I18N[enRating] ?? enRating)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{backgroundColor: scoreColor(metric.score)}}
          >
            {metric.score}
          </div>
        </div>
      </div>
      {metric.detail && metric.value === null && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic">{metric.detail}</p>
      )}
    </div>
  );
}

// ── Group card ──

function GroupCard({group}: {group: ScoringGroupData}) {
  const {t} = useTranslation();
  const avgScore = group.metrics.reduce((s, m) => s + m.score, 0) / group.metrics.length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{group.name}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('scoring.weightInTotal', {pct: group.weight_pct})}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-lg font-bold" style={{color: scoreColor(avgScore)}}>
              {group.total_weighted.toFixed(1)}
            </div>
            <div className="text-[10px] text-gray-400">{t('scoring.of', {max: group.weight_pct})}</div>
          </div>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
            style={{backgroundColor: scoreColor(avgScore)}}
          >
            {avgScore.toFixed(1)}
          </div>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {group.metrics.map((m, i) => (
          <MetricBadge key={i} metric={m} />
        ))}
      </div>
    </div>
  );
}

// ── Bot scoring card ──

function BotCard({data}: {data: BotScoringData}) {
  const tc = scoreColor(data.total_score);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{data.bot_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
              {data.strategy && <span>📋 {data.strategy}</span>}
              {data.exchange && <span>🏛️ {data.exchange}</span>}
              <span>{data.is_dry_run ? '🧪 Dry-Run' : '🔴 Live'}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{color: tc}}>
              {data.total_percent.toFixed(0)}%
            </div>
            <div className="text-sm text-gray-500">{data.total_score.toFixed(2)} / 10</div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-3 w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${data.total_percent}%`,
              backgroundColor: tc,
            }}
          />
        </div>

        {/* Rating badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.values(data.groups).map((g, i) => {
            const avg = g.metrics.reduce((s, m) => s + m.score, 0) / g.metrics.length;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: scoreColor(avg) + '20',
                  color: scoreColor(avg),
                  border: `1px solid ${scoreColor(avg)}40`,
                }}
              >
                {g.name}: {avg.toFixed(1)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Groups grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Object.entries(data.groups).map(([key, group]) => (
          <GroupCard key={key} group={group} />
        ))}
      </div>
    </div>
  );
}

// ── Empty state ──

function EmptyState() {
  const {t} = useTranslation();
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">📊</div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {t('scoring.noData')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        {t('scoring.noDataDesc')}
      </p>
    </div>
  );
}

// ── Main component ──

export function ScoringDashboard() {
  const { t } = useTranslation();
  const {data: bots, isLoading, error} = useQuery({
    queryKey: ['scoring'],
    queryFn: fetchScoring,
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
        <p className="text-red-600 dark:text-red-400">{t('scoring.loadError', {message: (error as Error).message})}</p>
      </div>
    );
  }

  if (!bots || bots.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📊 {t('scoring.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('scoring.subtitle')}
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {t('bots.count', {count: bots.length})} · {t('scoring.refreshEvery')}
        </div>
      </div>

      {/* Overall summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">{t('scoring.avgScoreAll')}:</span>
            {(() => {
              const avg = bots.reduce((s, b) => s + b.total_score, 0) / bots.length;
              return (
                <span className="text-2xl font-bold" style={{color: scoreColor(avg)}}>
                  {avg.toFixed(2)} / 10
                </span>
              );
            })()}
          </div>
          <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span><span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-1"/> {t('scoring.excellentRange')}</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-lime-500 mr-1"/> {t('scoring.goodRange')}</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-yellow-500 mr-1"/> {t('scoring.satisfactoryRange')}</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-orange-500 mr-1"/> {t('scoring.poorRange')}</span>
            <span><span className="inline-block w-3 h-3 rounded-full bg-red-500 mr-1"/> {t('scoring.dangerousRange')}</span>
          </div>
        </div>

        {/* Score distribution */}
        <div className="mt-3 flex gap-1 h-4 rounded-full overflow-hidden">
          {(() => {
            const ranges = [
              {min: 8, color: '#22c55e', label: t('scoring.excellent')},
              {min: 6, color: '#84cc16', label: t('scoring.good')},
              {min: 4, color: '#eab308', label: t('scoring.satisfactory')},
              {min: 2, color: '#f97316', label: t('scoring.poor')},
              {min: 0, color: '#ef4444', label: t('scoring.dangerous')},
            ];
            return ranges.map((r, i) => {
              const count = bots.filter(b => b.total_score >= r.min && (i === 0 || b.total_score < ranges[i-1].min)).length;
              const pct = (count / bots.length) * 100;
              return pct > 0 ? (
                <div
                  key={r.label}
                  className="relative group"
                  style={{width: `${pct}%`, backgroundColor: r.color, minWidth: count > 0 ? '4px' : 0}}
                  title={`${r.label}: ${t('bots.count', {count})}`}
                />
              ) : null;
            });
          })()}
        </div>
      </div>

      {/* Bot cards */}
      <div className="space-y-6">
        {bots.map(bot => (
          <BotCard key={bot.bot_id} data={bot} />
        ))}
      </div>
    </div>
  );
}
