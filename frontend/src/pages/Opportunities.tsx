/**
 * Opportunity Scanner — перспективные пары для торговли.
 * Сканер: импульс, отскок от перепроданности, пробой, восходящий тренд.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { useTranslation } from 'react-i18next';

interface Opportunity {
  symbol: string;
  pair: string;
  price: number;
  change_1d_pct: number;
  change_7d_pct: number;
  rsi: number | null;
  vol_ratio: number;
  above_ema50: boolean;
  ema50: number | null;
  categories: string[];
  score: number;
}

interface BotLite {
  id: string;
  name: string;
  is_dryrun: boolean;
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  all: { label: 'all', color: 'bg-gray-500' },
  momentum: { label: 'momentum', color: 'bg-blue-500' },
  oversold_bounce: { label: 'oversoldBounce', color: 'bg-green-500' },
  breakout: { label: 'breakout', color: 'bg-purple-500' },
  trend_up: { label: 'trendUp', color: 'bg-amber-500' },
};

export function Opportunities() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeCat, setActiveCat] = useState('all');
  const [selectedBot, setSelectedBot] = useState('');
  const [botMsg, setBotMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: oppData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const res = await api.get<any>('/opportunities');
      return res?.data?.data || res?.data || { items: [], scanned: 0 };
    },
  });

  const { data: bots = [] } = useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const res = await api.get<any>('/bots');
      return res?.data || [];
    },
  });

  const items: Opportunity[] = oppData?.items || [];

  const refreshMutation = useMutation({
    mutationFn: () => api.post('/opportunities/refresh'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opportunities'] }),
  });

  const addPairMutation = useMutation({
    mutationFn: async (pair: string) => {
      if (!selectedBot) throw new Error(t('opportunities.chooseBot'));
      const cfgRes = await api.get<any>(`/bots/${selectedBot}/config`);
      const cfg = cfgRes?.data?.config;
      if (!cfg) throw new Error(t('opportunities.noConfig'));
      const whitelist: string[] = cfg?.exchange?.pair_whitelist || [];
      if (!whitelist.includes(pair)) {
        whitelist.push(pair);
        cfg.exchange = { ...(cfg.exchange || {}), pair_whitelist: whitelist };
        await api.put(`/bots/${selectedBot}/config`, { config: cfg });
      }
      // reload — best effort: если бот сейчас недоступен, пара всё равно сохранена
      try {
        await api.post(`/bots/${selectedBot}/reload`);
      } catch {
        /* бот недоступен — подхватит пару при следующем рестарте */
      }
      return pair;
    },
    onSuccess: (pair) => {
      const bot = (bots as BotLite[]).find((b) => b.id === selectedBot);
      setBotMsg({ ok: true, text: `${pair} → ${bot?.name || selectedBot}` });
      setTimeout(() => setBotMsg(null), 4000);
    },
    onError: (e: any) => {
      setBotMsg({ ok: false, text: e?.message || t('opportunities.addFailed') });
      setTimeout(() => setBotMsg(null), 5000);
    },
  });

  const filtered = useMemo(() => {
    if (activeCat === 'all') return items;
    return items.filter((it) => it.categories.includes(activeCat));
  }, [items, activeCat]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    items.forEach((it) => it.categories.forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
    return counts;
  }, [items]);

  const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('opportunities.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('opportunities.subtitle', { scanned: oppData?.scanned || 0, found: items.length })}
          </p>
        </div>
        <button
          type="button"
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          {refreshMutation.isPending ? t('opportunities.scanning') : t('opportunities.rescan')}
        </button>
      </div>

      {/* Bot selector + add-to-pairs hint */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('opportunities.bot')}
            </label>
            <select
              value={selectedBot}
              onChange={(e) => setSelectedBot(e.target.value)}
              className="w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">{t('opportunities.chooseBot')}</option>
              {(bots as BotLite[]).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.is_dryrun ? ' (dry)' : ' (live)'}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 self-end pb-2">
            {t('opportunities.hint')}
          </p>
          {botMsg && (
            <span className={`text-sm self-end pb-2 ${botMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {botMsg.text}
            </span>
          )}
        </div>
      </Card>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveCat(key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              activeCat === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t(`opportunities.${meta.label}`)}
            <span className="ml-1.5 text-xs opacity-70">({catCounts[key] || 0})</span>
          </button>
        ))}
      </div>

      {/* Loading / Error / Empty */}
      {isLoading && (
        <div className="p-6 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">{t('opportunities.loading')}</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-red-500">
          {(error as Error)?.message || t('opportunities.loadFailed')}
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          {t('opportunities.empty')}
        </div>
      )}

      {/* Cards */}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it) => (
            <div
              key={it.pair}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white font-mono">{it.pair}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">${it.price.toLocaleString('en-US', { maximumFractionDigits: 6 })}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded ${
                    it.change_1d_pct >= 0
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  }`}
                >
                  {fmtPct(it.change_1d_pct)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
                <div className="text-gray-500 dark:text-gray-400">{t('opportunities.chg7d')}</div>
                <div className="text-gray-900 dark:text-white text-right">{fmtPct(it.change_7d_pct)}</div>
                <div className="text-gray-500 dark:text-gray-400">RSI(14)</div>
                <div className="text-gray-900 dark:text-white text-right">{it.rsi ?? '—'}</div>
                <div className="text-gray-500 dark:text-gray-400">{t('opportunities.volume')}</div>
                <div className="text-gray-900 dark:text-white text-right">{it.vol_ratio.toFixed(2)}x</div>
                <div className="text-gray-500 dark:text-gray-400">EMA50</div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${it.above_ema50 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {it.above_ema50 ? t('opportunities.above') : t('opportunities.below')}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex gap-1.5 flex-wrap">
                  {it.categories.map((c) => (
                    <span key={c} className={`${CATEGORY_META[c]?.color || 'bg-gray-500'} px-2 py-0.5 text-xs text-white rounded`}>
                      {t(`opportunities.${CATEGORY_META[c]?.label || c}`)}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={!selectedBot || addPairMutation.isPending}
                  onClick={() => addPairMutation.mutate(it.pair)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs rounded"
                >
                  {t('opportunities.addPair')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
