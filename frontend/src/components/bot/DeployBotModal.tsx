/**
 * DeployBotModal — 3-step wizard modal for deploying a new trading bot.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { strategyLabApi, Strategy } from '../../services/strategyLabApi';
import type { Bot } from '../../types';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export interface StrategyRecommendation {
  strategy_name: string;
  timeframe?: string;
  timerange?: string;
  profit_pct?: number;
  winrate_pct?: number;
  max_drawdown_pct?: number;
  profit_factor?: number;
  sharpe_ratio?: number;
  total_trades?: number;
  score: number;
  percent: number;
  recommendation: 'go' | 'watch' | 'no';
  reasons: string[];
}

interface DeployBotModalProps {
  open: boolean;
  onClose: () => void;
  initialStrategy?: string;
  /** Optional – pass recommendation data to show score badge */
  initialRecommendation?: StrategyRecommendation;
  onSuccess?: (bot: Bot) => void;
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-green-600 text-white';
  if (score >= 5) return 'bg-yellow-500 text-black';
  return 'bg-red-600 text-white';
}

export function DeployBotModal({
  open,
  onClose,
  initialStrategy,
  initialRecommendation,
  onSuccess,
}: DeployBotModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Wizard step: 1 = strategy, 2 = params, 3 = confirm
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState('');

  // Selected strategy
  const [selectedStrategy, setSelectedStrategy] = useState(initialStrategy || '');

  // Params
  const [botName, setBotName] = useState('');
  const [exchange, setExchange] = useState('binance');
  const [stakeAmount, setStakeAmount] = useState(100);
  const [pairs, setPairs] = useState('');
  const [dryRun, setDryRun] = useState(true);

  // Fetch strategies
  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['strategy-lab', 'strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
    enabled: open,
  });

  // Filtered strategies for search
  const filteredStrategies = useMemo(() => {
    if (!strategies) return [];
    if (!search.trim()) return strategies;
    const q = search.toLowerCase();
    return strategies.filter((s) => s.name.toLowerCase().includes(q));
  }, [strategies, search]);

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE}/bots/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          name: botName.trim(),
          strategy_name: selectedStrategy,
          host_port: 0,
          dry_run: dryRun,
          exchange: exchange.trim(),
          stake_amount: stakeAmount,
          pairs: pairs
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.detail || err?.error || `HTTP ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      onSuccess?.(data?.data || data);
      onClose();
      // Reset
      setStep(1);
      setBotName('');
      setExchange('binance');
      setStakeAmount(100);
      setPairs('');
      setDryRun(true);
    },
  });

  // Reset on close
  const handleClose = () => {
    setStep(1);
    setSearch('');
    onClose();
  };

  const canProceedFromStep1 = !!selectedStrategy;
  const canProceedFromStep2 = !!botName.trim() && !!selectedStrategy;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('bots.deployBotTitle')}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s === step
                    ? 'bg-blue-600 text-white'
                    : s < step
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {s < step ? '✓' : s}
              </div>
              <span
                className={`text-sm ${
                  s === step
                    ? 'text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {s === 1
                  ? t('bots.deployStepStrategy')
                  : s === 2
                    ? t('bots.deployStepParams')
                    : t('bots.deployStepConfirm')}
              </span>
              {s < 3 && <div className="w-8 h-px bg-gray-300 dark:bg-gray-600 mx-1" />}
            </div>
          ))}
        </div>

        <div className="p-6">
          {/* STEP 1: Strategy selection */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('backtest.selectStrategy')}
              </p>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
              {strategiesLoading ? (
                <div className="text-center py-8 text-gray-500 text-sm">{t('common.loading')}</div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredStrategies.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500 text-sm">
                      {t('common.noResults')}
                    </div>
                  ) : (
                    filteredStrategies.map((s) => {
                      const recommendation =
                        initialRecommendation &&
                        initialRecommendation.strategy_name === s.name
                          ? initialRecommendation
                          : null;
                      const isSelected = selectedStrategy === s.name;
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => setSelectedStrategy(s.name)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                            isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {isSelected && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {s.name}
                            </span>
                            {s.family && (
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {s.family}
                              </span>
                            )}
                            {recommendation && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${getScoreColor(recommendation.score)}`}
                              >
                                {recommendation.score}/10
                              </span>
                            )}
                          </div>
                          {recommendation?.recommendation === 'go' && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              {t('bots.deployRecommended')}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Parameters */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('bots.deployBotName')}
                </label>
                <input
                  type="text"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder={t('bots.deployBotNamePlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('bots.deployExchange')}
                </label>
                <input
                  type="text"
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('bots.deployStake')}
                </label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('bots.deployPairs')}
                </label>
                <input
                  type="text"
                  value={pairs}
                  onChange={(e) => setPairs(e.target.value)}
                  placeholder={t('bots.deployPairsPlaceholder')}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="dry-run-check"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="mt-1 rounded border-gray-300 dark:border-gray-600"
                />
                <div>
                  <label htmlFor="dry-run-check" className="text-sm text-gray-700 dark:text-gray-300">
                    Dry-run
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('bots.deployDryRunHint')}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                {t('bots.deployAutoPort')}
              </p>
            </div>
          )}

          {/* STEP 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                {t('bots.deploySummary')}
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployBotName')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{botName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployStrategy')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{selectedStrategy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployExchange')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{exchange}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployStake')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{stakeAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployPairs')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {pairs || t('common.none')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployDryRun')}</span>
                  <span className={`font-medium ${dryRun ? 'text-yellow-600' : 'text-green-600'}`}>
                    {dryRun ? t('bots.dryRun') : t('bots.live')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('bots.deployPort')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">{t('bots.deployAutoPort')}</span>
                </div>
              </div>

              {deployMutation.isError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  {(deployMutation.error as Error)?.message || t('bots.deployFailed')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {t('common.cancel')}
          </button>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors"
              >
                {t('bots.deployBack')}
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 ? !canProceedFromStep1 : !canProceedFromStep2}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {t('bots.deployNext')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => deployMutation.mutate()}
                disabled={deployMutation.isPending}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
              >
                {deployMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('bots.deploying')}
                  </span>
                ) : (
                  t('bots.deployConfirm')
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
