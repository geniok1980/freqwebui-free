/**
 * API-токены — scoped access tokens для людей и агентов (read / write / control).
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card } from '../components/common/Card';
import { useTranslation } from 'react-i18next';

interface ApiTokenInfo {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string;
  created_by: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked: boolean;
}

const SCOPE_OPTIONS = [
  { value: 'read', label: 'read', desc: 'scopes.readDesc' },
  { value: 'read,write', label: 'read,write', desc: 'scopes.writeDesc' },
  { value: 'read,write,control', label: 'read,write,control', desc: 'scopes.controlDesc' },
];

export function ApiTokens() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState('read');
  const [createdToken, setCreatedToken] = useState<{ token: string; name: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: tokens = [], isLoading, isError } = useQuery({
    queryKey: ['api-tokens'],
    queryFn: async () => {
      const res = await api.get<any>('/auth/tokens');
      return res?.data || [];
    },
  });

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error(t('apiTokens.enterName'));
      const res = await api.post<any>('/auth/tokens', { name: name.trim(), scopes });
      return res?.data;
    },
    onSuccess: (data) => {
      setCreatedToken({ token: data.token, name: data.name });
      setName('');
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: (e: any) => flash(false, e?.message || t('apiTokens.createFailed')),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/tokens/${id}`);
    },
    onSuccess: () => {
      flash(true, t('apiTokens.revoked'));
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] });
    },
    onError: (e: any) => flash(false, e?.message || t('apiTokens.revokeFailed')),
  });

  const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleString() : '—');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('apiTokens.title')}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-6">{t('apiTokens.subtitle')}</p>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${msg.ok ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Create form */}
      <Card className="p-5 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('apiTokens.create')}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('apiTokens.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('apiTokens.namePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('apiTokens.scopes')}</label>
            <select
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              className="w-52 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {SCOPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
          >
            {createMutation.isPending ? t('apiTokens.creating') : t('apiTokens.createBtn')}
          </button>
        </div>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {t('apiTokens.scopeHint')}: {t('apiTokens.' + (SCOPE_OPTIONS.find(o => o.value === scopes)?.desc || 'readDesc'))}
        </p>
      </Card>

      {/* Created token (one-time) */}
      {createdToken && (
        <div className="mb-6 p-5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            {t('apiTokens.tokenCreated')}: {createdToken.name}
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">{t('apiTokens.copyWarning')}</p>
          <code className="block px-3 py-2 bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-700 rounded text-sm break-all select-all font-mono">
            {createdToken.token}
          </code>
          <button
            type="button"
            onClick={() => setCreatedToken(null)}
            className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded"
          >
            {t('apiTokens.gotIt')}
          </button>
        </div>
      )}

      {/* Token list */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('apiTokens.list')}</h2>

        {isLoading && <p className="text-gray-500">{t('apiTokens.loading')}</p>}
        {isError && <p className="text-red-500">{t('apiTokens.loadFailed')}</p>}

        {!isLoading && !isError && (tokens as ApiTokenInfo[]).length === 0 && (
          <p className="text-gray-500 dark:text-gray-400">{t('apiTokens.empty')}</p>
        )}

        {(tokens as ApiTokenInfo[]).map((tk) => (
          <div key={tk.id} className={`border rounded-lg p-4 mb-3 ${tk.revoked ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-200 dark:border-gray-700'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 dark:text-white">{tk.name}</span>
                <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">{tk.token_prefix}…</code>
                <span className={`px-2 py-0.5 text-xs rounded ${tk.revoked ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>
                  {tk.scopes}
                </span>
                {tk.revoked && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                    {t('apiTokens.revokedBadge')}
                  </span>
                )}
              </div>
              {!tk.revoked && (
                <button
                  type="button"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(tk.id)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs rounded"
                >
                  {t('apiTokens.revoke')}
                </button>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 grid grid-cols-1 sm:grid-cols-3 gap-1">
              <span>{t('apiTokens.createdBy')}: {tk.created_by}</span>
              <span>{t('apiTokens.createdAt')}: {fmtDate(tk.created_at)}</span>
              <span>{t('apiTokens.lastUsed')}: {fmtDate(tk.last_used_at)}</span>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
