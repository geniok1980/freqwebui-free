/**
 * Страница «Версии стратегий»: история изменений кода стратегий + откат.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { strategyLabApi, StrategyVersion } from '../../services/strategyLabApi';
import { Card } from '../../components/common/Card';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function StrategyVersions() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedStrategy, setSelectedStrategy] = useState('all');
  const [viewSource, setViewSource] = useState<{ meta: any; source: string } | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [recordStrategy, setRecordStrategy] = useState('');
  const [recordComment, setRecordComment] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<StrategyVersion | null>(null);

  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies() as Promise<any[]>,
  });

  const {
    data: versions = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['strategy-versions', selectedStrategy],
    queryFn: () =>
      strategyLabApi.getStrategyVersions(
        selectedStrategy === 'all' ? undefined : selectedStrategy
      ) as Promise<StrategyVersion[]>,
  });

  const restoreMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const res = await strategyLabApi.restoreStrategyVersion(versionId);
      return res?.data || res;
    },
    onSuccess: (res) => {
      setRestoreTarget(null);
      queryClient.invalidateQueries({ queryKey: ['strategy-versions'] });
      const bots = (res?.updated_bots || []).length;
      alert(
        `${t('strategyVersions.restoreSuccess')} (${res?.restored_version})\n` +
        `${t('strategyVersions.botsUpdated', { count: bots })}`
      );
    },
    onError: (e: any) => {
      setRestoreTarget(null);
      alert(e?.message || t('strategyVersions.restoreFailed'));
    },
  });

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!recordStrategy) throw new Error(t('strategyVersions.chooseStrategy'));
      await strategyLabApi.recordStrategyVersion(recordStrategy, recordComment);
    },
    onSuccess: () => {
      setShowRecord(false);
      setRecordComment('');
      setSelectedStrategy(recordStrategy);
      queryClient.invalidateQueries({ queryKey: ['strategy-versions'] });
    },
    onError: (e: any) => {
      alert(e?.message || t('strategyVersions.recordFailed'));
    },
  });

  const strategyNames = useMemo(() => {
    const names = new Set<string>();
    versions.forEach((v) => names.add(v.strategy_name));
    strategies.forEach((s) => s.name && names.add(s.name));
    return [...names].sort();
  }, [versions, strategies]);

  const fmtDate = (iso?: string) => {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return format(d, 'dd.MM.yyyy HH:mm', { locale: i18n.language === 'ru' ? ru : undefined });
    } catch {
      return iso;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('strategyVersions.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('strategyVersions.subtitle', { count: versions.length })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowRecord(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
          >
            {t('strategyVersions.recordNow')}
          </button>
          <Link
            to="/strategy-lab/strategies"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm"
          >
            {t('strategyVersions.backToStrategies')}
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-4 mb-6">
        <select
          value={selectedStrategy}
          onChange={(e) => setSelectedStrategy(e.target.value)}
          className="w-72 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">{t('strategyVersions.allStrategies')}</option>
          {strategyNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Record modal */}
      {showRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowRecord(false)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('strategyVersions.recordTitle')}</h2>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('strategyVersions.strategy')}
            </label>
            <select
              value={recordStrategy}
              onChange={(e) => setRecordStrategy(e.target.value)}
              className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">{t('strategyVersions.chooseStrategy')}</option>
              {strategyNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('strategyVersions.comment')}
            </label>
            <input
              type="text"
              value={recordComment}
              onChange={(e) => setRecordComment(e.target.value)}
              placeholder={t('strategyVersions.commentPlaceholder')}
              className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRecord(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={!recordStrategy || recordMutation.isPending}
                onClick={() => recordMutation.mutate()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {recordMutation.isPending ? t('strategyVersions.saving') : t('strategyVersions.saveVersion')}
              </button>
            </div>
            </Card>
          </div>
        </div>
      )}

      {/* Restore confirm modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRestoreTarget(null)}>
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Card className="p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('strategyVersions.restoreTitle')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {t('strategyVersions.restoreConfirm')} <b>{restoreTarget.strategy_name}</b> v{restoreTarget.version}
              {' — '}{restoreTarget.comment || '—'}?
            </p>
            <p className="text-xs text-red-500 mb-4">{t('strategyVersions.restoreWarning')}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(restoreTarget.id)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                {restoreMutation.isPending ? t('strategyVersions.restoring') : t('strategyVersions.restore')}
              </button>
            </div>
            </Card>
          </div>
        </div>
      )}

      {/* Source view modal */}
      {viewSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewSource(null)}>
          <div
            className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {viewSource.meta.strategy_name} v{viewSource.meta.version}
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  {viewSource.meta.comment || ''} · {fmtDate(viewSource.meta.created_at)}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setViewSource(null)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <pre className="p-4 overflow-auto max-h-[70vh] text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 whitespace-pre">
              {viewSource.source}
            </pre>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading && (
        <div className="p-6 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">{t('strategyVersions.loading')}</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-red-500">
          {(error as Error)?.message || t('strategyVersions.loadFailed')}
        </div>
      )}

      {!isLoading && !isError && versions.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {t('strategyVersions.empty')}
        </div>
      )}

      {!isLoading && !isError && versions.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3">{t('strategyVersions.version')}</th>
                <th className="px-4 py-3">{t('strategyVersions.strategy')}</th>
                <th className="px-4 py-3">{t('strategyVersions.date')}</th>
                <th className="px-4 py-3">{t('strategyVersions.author')}</th>
                <th className="px-4 py-3">{t('strategyVersions.comment')}</th>
                <th className="px-4 py-3">{t('strategyVersions.bot')}</th>
                <th className="px-4 py-3 text-right">{t('strategyVersions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs rounded">
                      v{v.version}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-900 dark:text-white">{v.strategy_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{fmtDate(v.created_at)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.created_by || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[220px] truncate" title={v.comment || ''}>
                    {v.comment || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{v.bot_id || '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() =>
                        strategyLabApi.getStrategyVersionSource(v.id).then((res) => res && setViewSource(res))
                      }
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded mr-2"
                    >
                      {t('strategyVersions.view')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoreTarget(v)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                    >
                      {t('strategyVersions.restore')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
