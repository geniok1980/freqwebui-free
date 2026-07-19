/**
 * Risk Management Dashboard — 4 уровня контроля рисков (уроки 14, 25).
 *
 * Level 1 — Риск на сделку
 * Level 2 — Риск портфеля
 * Level 3 — Дневной лимит убытка
 * Level 4 — Недельный лимит убытка
 */

import {useQuery} from '@tanstack/react-query';
import {api} from '../services/api';

// ── Types ──

interface RiskLevel {
  status: string;
  label: string;
  value_pct: number;
  fill_pct: number;
  description: string;
  risk_abs?: number;
  position_size?: number;
  stop_loss_pct?: number;
  open_positions?: number;
  loss_pct?: number;
}

interface BotRiskData {
  bot_id: string;
  bot_name: string;
  is_dry_run: boolean;
  strategy: string | null;
  exchange: string | null;
  available: boolean;
  message?: string;
  overall: {
    status: string;
    label: string;
    score: number;
  };
  balance: {
    total: number;
    open_positions: number;
    closed_trades: number;
    win_rate: number;
    profit_pct: number;
    drawdown_pct: number;
  };
  levels: {
    level_1_per_trade: RiskLevel;
    level_2_portfolio: RiskLevel;
    level_3_daily: RiskLevel;
    level_4_weekly: RiskLevel;
  };
  stop_loss: {
    current_drawdown: {status: string; label: string; value_pct: number; fill_pct: number};
    config: {type: string; pct: number};
    trailing: {enabled: boolean; offset_pct: number; trigger_pct: number};
    protection: Record<string, string>;
  };
  config: {
    total_capital: number;
    stake_amount: number;
    max_open_trades: number;
    stoploss_pct: number;
    trailing_stop: boolean;
    daily_loss_limit_pct: number;
    weekly_loss_limit_pct: number;
  };
}

// ── Colour helpers ──

function statusColors(status: string) {
  switch (status) {
    case 'safe': return {bg: 'bg-green-100 dark:bg-green-900/30', border: 'border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-500'};
    case 'moderate': return {bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300', bar: 'bg-yellow-500'};
    case 'aggressive': return {bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500'};
    case 'critical': return {bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-300 dark:border-red-700', text: 'text-red-700 dark:text-red-300', bar: 'bg-red-500'};
    default: return {bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-700', bar: 'bg-gray-500'};
  }
}

// ── Level card ──

function LevelCard({level, title, icon, subtitle}: {
  level: RiskLevel;
  title: string;
  icon: string;
  subtitle?: string;
}) {
  const c = statusColors(level.status);
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h4>
          </div>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.text} ${c.bg} border ${c.border}`}>
          {level.value_pct.toFixed(1)}%
        </div>
      </div>
      <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${c.bar}`}
          style={{width: `${level.fill_pct}%`}}
        />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs font-medium ${c.text}`}>{level.label}</span>
        {level.risk_abs !== undefined && (
          <span className="text-[10px] text-gray-500">${level.risk_abs.toFixed(2)}</span>
        )}
      </div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{level.description}</p>
    </div>
  );
}

// ── Bot risk card ──

function BotRiskCard({data}: {data: BotRiskData}) {
  const c = statusColors(data.overall.status);

  if (!data.available) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white">{data.bot_name}</h3>
        <p className="text-sm text-gray-400 mt-1">{data.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{data.bot_name}</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {data.strategy && <span>📋 {data.strategy}</span>}
              {data.exchange && <span>🏛️ {data.exchange}</span>}
              <span>{data.is_dry_run ? '🧪 Dry-Run' : '🔴 Live'}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${c.text}`}>{data.overall.label}</div>
            <div className="text-sm text-gray-500">Score: {data.overall.score}/10</div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
            <div className="text-lg font-bold text-gray-900 dark:text-white">${data.balance.total.toFixed(0)}</div>
            <div className="text-[10px] text-gray-500">Капитал</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
            <div className={`text-lg font-bold ${data.balance.profit_pct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.balance.profit_pct >= 0 ? '+' : ''}{data.balance.profit_pct}%
            </div>
            <div className="text-[10px] text-gray-500">Прибыль</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
            <div className={`text-lg font-bold ${data.balance.drawdown_pct < 5 ? 'text-green-600' : data.balance.drawdown_pct < 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.balance.drawdown_pct}%
            </div>
            <div className="text-[10px] text-gray-500">Просадка</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
            <div className="text-lg font-bold text-gray-900 dark:text-white">{data.balance.win_rate}%</div>
            <div className="text-[10px] text-gray-500">Win Rate</div>
          </div>
        </div>
      </div>

      {/* 4 Risk Levels */}
      <div className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
          4 уровня контроля рисков
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LevelCard
            level={data.levels.level_1_per_trade}
            title="На сделку"
            icon="1️⃣"
            subtitle={`${data.config.stoploss_pct}% SL · $${data.config.stake_amount} позиция`}
          />
          <LevelCard
            level={data.levels.level_2_portfolio}
            title="Портфельный"
            icon="2️⃣"
            subtitle={`${data.balance.open_positions} из ${data.config.max_open_trades} позиций`}
          />
          <LevelCard
            level={data.levels.level_3_daily}
            title="Дневной лимит"
            icon="3️⃣"
            subtitle={`Лимит: ${data.config.daily_loss_limit_pct}%`}
          />
          <LevelCard
            level={data.levels.level_4_weekly}
            title="Недельный лимит"
            icon="4️⃣"
            subtitle={`Лимит: ${data.config.weekly_loss_limit_pct}%`}
          />
        </div>
      </div>

      {/* Stop-loss & Protection */}
      <div className="p-5 border-t border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Current drawdown */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Текущая просадка
            </h4>
            <div className={`rounded-lg p-3 border ${statusColors(data.stop_loss.current_drawdown.status).bg} ${statusColors(data.stop_loss.current_drawdown.status).border}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Просадка</span>
                <span className="text-sm font-bold" style={{
                  color: data.stop_loss.current_drawdown.status === 'safe' ? '#22c55e' :
                         data.stop_loss.current_drawdown.status === 'moderate' ? '#eab308' : '#ef4444'
                }}>
                  {data.stop_loss.current_drawdown.value_pct}%
                </span>
              </div>
              <div className="text-xs">{data.stop_loss.current_drawdown.label}</div>
            </div>
          </div>

          {/* Stop-loss config */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Стоп-лосс
            </h4>
            <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
              <div className="flex justify-between"><span>Тип</span><span className="font-mono font-medium">{data.stop_loss.config.type}</span></div>
              <div className="flex justify-between"><span>Процент</span><span className="font-mono font-medium">{data.stop_loss.config.pct}%</span></div>
              <div className="flex justify-between"><span>Трейлинг</span><span>{data.stop_loss.trailing.enabled ? '✅' : '❌'}</span></div>
              {data.stop_loss.trailing.enabled && (
                <>
                  <div className="flex justify-between"><span>Offset</span><span className="font-mono">{data.stop_loss.trailing.offset_pct}%</span></div>
                  <div className="flex justify-between"><span>Триггер</span><span className="font-mono">{data.stop_loss.trailing.trigger_pct}%</span></div>
                </>
              )}
            </div>
          </div>

          {/* Protection mechanisms */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Защита
            </h4>
            <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
              {Object.entries(data.stop_loss.protection).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span>{key.replace(/_/g, ' ')}</span>
                  <span className={`font-medium ${val.includes('вкл') ? 'text-green-600' : val.includes('реком') ? 'text-yellow-600' : ''}`}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommended config */}
      <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Рекомендуемая конфигурация
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-gray-700 dark:text-gray-300">
          <div>stake: ${data.config.stake_amount.toFixed(0)}</div>
          <div>max_pos: {data.config.max_open_trades}</div>
          <div>SL: {data.config.stoploss_pct}%</div>
          <div>trailing: {data.config.trailing_stop ? 'ON' : 'OFF'}</div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ──

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">🛡️</div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Нет данных о рисках
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        Для отображения Risk Dashboard необходим хотя бы один бот с собранными метриками.
      </p>
    </div>
  );
}

// ── Main component ──

export function RiskDashboard() {
  const {data: bots, isLoading, error} = useQuery({
    queryKey: ['risk'],
    queryFn: async () => {
      const res = await api.get<BotRiskData[]>('/risk');
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

  if (!bots || bots.length === 0) {
    return <EmptyState />;
  }

  const safe = bots.filter(b => b.available && b.overall.status === 'safe').length;
  const moderate = bots.filter(b => b.available && b.overall.status === 'moderate').length;
  const aggressive = bots.filter(b => b.available && b.overall.status === 'aggressive').length;
  const critical = bots.filter(b => b.available && b.overall.status === 'critical').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🛡️ Риски
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            4 уровня контроля рисков — уроки 14, 25
          </p>
        </div>
      </div>

      {/* Fleet overview */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
          Общий риск флота
        </h3>
        <div className="flex gap-4">
          <div className="flex-1 text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-2xl font-bold text-green-600">{safe}</div>
            <div className="text-xs text-green-700 dark:text-green-300">🟢 Безопасно</div>
          </div>
          <div className="flex-1 text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="text-2xl font-bold text-yellow-600">{moderate}</div>
            <div className="text-xs text-yellow-700 dark:text-yellow-300">🟡 Умеренно</div>
          </div>
          <div className="flex-1 text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <div className="text-2xl font-bold text-orange-600">{aggressive}</div>
            <div className="text-xs text-orange-700 dark:text-orange-300">🟠 Повышенный</div>
          </div>
          <div className="flex-1 text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="text-2xl font-bold text-red-600">{critical}</div>
            <div className="text-xs text-red-700 dark:text-red-300">🔴 Критично</div>
          </div>
        </div>
      </div>

      {/* Risk legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0"/>
          <span>1️⃣ Риск на сделку: &lt;1%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0"/>
          <span>2️⃣ Портфельный риск: &lt;5%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"/>
          <span>3️⃣ Дневной убыток: &lt;2%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"/>
          <span>4️⃣ Недельный убыток: &lt;10%</span>
        </div>
      </div>

      {/* Bot cards */}
      <div className="space-y-6">
        {bots.map(bot => (
          <BotRiskCard key={bot.bot_id} data={bot} />
        ))}
      </div>
    </div>
  );
}
