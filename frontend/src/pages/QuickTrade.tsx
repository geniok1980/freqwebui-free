/**
 * Quick Trade — быстрая сделка: принудительный вход (forcebuy) и выход.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { useTranslation } from 'react-i18next';

interface BotLite {
  id: string;
  name: string;
  is_dryrun: boolean;
  strategy: string;
}

interface Trade {
  trade_id: number;
  pair: string;
  amount: number;
  open_rate: number;
  current_rate: number | null;
  profit_abs: number | null;
  profit_ratio: number | null;
  is_open: boolean;
  open_timestamp?: number;
}

export function QuickTrade() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedBot, setSelectedBot] = useState('');
  const [pair, setPair] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');
  const [price, setPrice] = useState('');
  const [tpPct, setTpPct] = useState('');
  const [slPct, setSlPct] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: bots = [] } = useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const res = await api.get<any>('/bots');
      return res?.data || [];
    },
  });

  const { data: pairlist = [] } = useQuery({
    queryKey: ['bot-pairlist', selectedBot],
    enabled: !!selectedBot,
    queryFn: async () => {
      const res = await api.get<any>(`/bots/${selectedBot}/config`);
      return res?.data?.config?.exchange?.pair_whitelist || [];
    },
  });

  const { data: openTrades = [], refetch: refetchTrades } = useQuery({
    queryKey: ['bot-open-trades', selectedBot],
    enabled: !!selectedBot,
    queryFn: async () => {
      const res = await api.get<any>(`/bots/${selectedBot}/trades?is_open=true`);
      return res?.data || [];
    },
  });

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const buyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBot) throw new Error(t('quickTrade.chooseBot'));
      if (!pair) throw new Error(t('quickTrade.enterPair'));
      const body: Record<string, any> = { pair };
      if (stakeAmount) body.stake_amount = parseFloat(stakeAmount);
      if (price) body.price = parseFloat(price);
      if (tpPct) body.take_profit_pct = parseFloat(tpPct);
      if (slPct) body.stop_loss_pct = parseFloat(slPct);
      const res = await api.post(`/bots/${selectedBot}/forcebuy`, body);
      return res;
    },
    onSuccess: (res: any) => {
      flash(true, res?.message || t('quickTrade.buyOk'));
      setPair(''); setStakeAmount(''); setPrice(''); setTpPct(''); setSlPct('');
      refetchTrades();
      queryClient.invalidateQueries({ queryKey: ['bot-open-trades'] });
    },
    onError: (e: any) => flash(false, e?.message || t('quickTrade.buyFailed')),
  });

  const exitMutation = useMutation({
    mutationFn: async (tradeId: number) => {
      await api.post(`/bots/${selectedBot}/forceexit-trade?trade_id=${tradeId}`);
    },
    onSuccess: () => {
      flash(true, t('quickTrade.exitOk'));
      refetchTrades();
    },
    onError: (e: any) => flash(false, e?.message || t('quickTrade.exitFailed')),
  });

  const closeAllMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/bots/${selectedBot}/forceexit`);
    },
    onSuccess: () => {
      flash(true, t('quickTrade.exitAllOk'));
      refetchTrades();
    },
    onError: (e: any) => flash(false, e?.message || t('quickTrade.exitAllFailed')),
  });

  const calcTpSl = useMemo(() => {
    const base = price ? parseFloat(price) : null;
    const tp = tpPct ? parseFloat(tpPct) : null;
    const sl = slPct ? parseFloat(slPct) : null;
    return {
      tpPrice: base && tp ? base * (1 + tp / 100) : null,
      slPrice: base && sl ? base * (1 - sl / 100) : null,
    };
  }, [price, tpPct, slPct]);

  const fmtUsd = (v: number | null | undefined) =>
    v == null ? '—' : `$${v.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;

  const fmtPct = (v: number | null | undefined) =>
    v == null ? '—' : `${(v >= 0 ? '+' : '')}${(v * 100).toFixed(2)}%`;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('quickTrade.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('quickTrade.subtitle')}</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buy form */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('quickTrade.openPosition')}</h2>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickTrade.bot')}</label>
          <select
            value={selectedBot}
            onChange={(e) => { setSelectedBot(e.target.value); setPair(''); }}
            className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">{t('quickTrade.chooseBot')}</option>
            {(bots as BotLite[]).map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.is_dryrun ? ' (dry)' : ' (live)'}</option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickTrade.pair')}</label>
          <input
            type="text"
            list="qt-pairlist"
            value={pair}
            onChange={(e) => setPair(e.target.value.toUpperCase())}
            placeholder="BTC/USDT"
            className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono"
          />
          <datalist id="qt-pairlist">
            {(pairlist as string[]).map((p) => <option key={p} value={p} />)}
          </datalist>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickTrade.stake')}</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder={t('quickTrade.stakePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickTrade.price')}</label>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t('quickTrade.pricePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickTrade.tp')}</label>
              <input
                type="number"
                step="any"
                value={tpPct}
                onChange={(e) => setTpPct(e.target.value)}
                placeholder="%"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('quickTrade.sl')}</label>
              <input
                type="number"
                step="any"
                value={slPct}
                onChange={(e) => setSlPct(e.target.value)}
                placeholder="%"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {calcTpSl.tpPrice && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
              {t('quickTrade.tpPrice')}: <b className="text-green-600 dark:text-green-400">{fmtUsd(calcTpSl.tpPrice)}</b>
              {calcTpSl.slPrice && <> · {t('quickTrade.slPrice')}: <b className="text-red-500">{fmtUsd(calcTpSl.slPrice)}</b></>}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('quickTrade.tpSlHint')}</p>

          <button
            type="button"
            disabled={!selectedBot || !pair || buyMutation.isPending}
            onClick={() => buyMutation.mutate()}
            className="mt-4 w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {buyMutation.isPending ? t('quickTrade.placing') : t('quickTrade.openPosition')}
          </button>
        </Card>

        {/* Open trades */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('quickTrade.openTrades')}</h2>
            {selectedBot && (openTrades as Trade[]).length > 0 && (
              <button
                type="button"
                disabled={closeAllMutation.isPending}
                onClick={() => closeAllMutation.mutate()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded"
              >
                {t('quickTrade.closeAll')}
              </button>
            )}
          </div>

          {!selectedBot && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('quickTrade.chooseBotFirst')}</p>
          )}

          {selectedBot && (openTrades as Trade[]).length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('quickTrade.noOpenTrades')}</p>
          )}

          {(openTrades as Trade[]).map((tr) => (
            <div key={tr.trade_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{tr.pair}</span>
                <span className={`text-sm font-semibold ${(tr.profit_ratio ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {fmtPct(tr.profit_ratio)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm text-gray-600 dark:text-gray-300">
                <div>{t('quickTrade.tradeId')}: #{tr.trade_id}</div>
                <div>{t('quickTrade.amount')}: {tr.amount}</div>
                <div>{t('quickTrade.openRate')}: {fmtUsd(tr.open_rate)}</div>
              </div>
              <button
                type="button"
                disabled={exitMutation.isPending}
                onClick={() => exitMutation.mutate(tr.trade_id)}
                className="mt-3 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded"
              >
                {t('quickTrade.close')}
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
