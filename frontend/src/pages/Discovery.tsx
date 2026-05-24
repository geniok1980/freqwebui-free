/**
 * Discovery page for managing bot discovery scans.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import { StatusIndicator } from '../components/common/StatusIndicator';
import type { Bot } from '../types';

interface DiscoveryStatus {
  docker_enabled: boolean;
  docker_available: boolean;
  filesystem_enabled: boolean;
  filesystem_available: boolean;
  last_scan: string | null;
  scan_interval_seconds: number;
  next_scan: string | null;
}

interface DiscoveryResult {
  discovered: number;
  new: number;
  updated: number;
  removed: number;
  bots?: Bot[];
}

interface ManualBotForm {
  name: string;
  api_url: string;
  username: string;
  password: string;
}

export function Discovery() {
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<DiscoveryResult | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<ManualBotForm>({
    name: '',
    api_url: '',
    username: '',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['discovery', 'status'],
    queryFn: async (): Promise<DiscoveryStatus> => {
      const response = await api.get<{ data: DiscoveryStatus }>('/discovery/status');
      return response.data?.data || response.data;
    },
    refetchInterval: 30000,
  });

  // Fetch all bots
  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: async (): Promise<Bot[]> => {
      const response = await api.get<Bot[]>('/bots');
      return response.data;
    },
  });

  const triggerScan = useMutation({
    mutationFn: async (): Promise<DiscoveryResult> => {
      const response = await api.post<{ data: DiscoveryResult }>('/discovery/trigger');
      return response.data?.data || response.data;
    },
    onSuccess: (result) => {
      setLastResult(result);
      queryClient.invalidateQueries({ queryKey: ['discovery', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
  });

  const addManualBot = useMutation({
    mutationFn: async (form: ManualBotForm) => {
      const response = await api.post('/discovery/manual', {
        name: form.name,
        api_url: form.api_url,
        username: form.username || undefined,
        password: form.password || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      setShowManualForm(false);
      setManualForm({ name: '', api_url: '', username: '', password: '' });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['bots'] });
    },
    onError: (error: any) => {
      setFormError(error.message || 'Не удалось добавить бота');
    },
  });

  const deleteBot = useMutation({
    mutationFn: async (botId: string) => {
      const response = await api.delete(`/bots/${botId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
    },
    onError: (error: any) => {
      alert(error.message || 'Не удалось удалить бота');
    },
  });

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!manualForm.name.trim()) {
      setFormError('Требуется имя бота');
      return;
    }
    if (!manualForm.api_url.trim()) {
      setFormError('Требуется API URL');
      return;
    }
    addManualBot.mutate(manualForm);
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Никогда';
    try {
      return format(new Date(dateStr), 'PPp');
    } catch {
      return dateStr;
    }
  };

  const formatInterval = (seconds: number): string => {
    if (seconds < 60) return `${seconds} сек`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
    return `${Math.round(seconds / 3600)} ч`;
  };

  const getEnvironmentBadge = (env: string) => {
    const colors: Record<string, string> = {
      docker: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200',
      manual: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
      baremetal: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
      k8s: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200',
    };
    return colors[env] || colors.baremetal;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Обнаружение ботов
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Управление автоматическим и ручным обнаружением ботов
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Добавить бота вручную
          </button>
          <button
            onClick={() => triggerScan.mutate()}
            disabled={triggerScan.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {triggerScan.isPending ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Сканирование...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Сканировать
              </>
            )}
          </button>
        </div>
      </div>

      {/* Last Scan Result */}
      {lastResult && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-green-800 dark:text-green-200">
              Сканирование завершено успешно
            </h3>
            <button
              onClick={() => setLastResult(null)}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
            <div>
              <span className="text-green-600 dark:text-green-400">Обнаружено:</span>
              <span className="ml-2 font-medium text-green-800 dark:text-green-200">{lastResult.discovered}</span>
            </div>
            <div>
              <span className="text-green-600 dark:text-green-400">Новых:</span>
              <span className="ml-2 font-medium text-green-800 dark:text-green-200">{lastResult.new}</span>
            </div>
            <div>
              <span className="text-green-600 dark:text-green-400">Обновлено:</span>
              <span className="ml-2 font-medium text-green-800 dark:text-green-200">{lastResult.updated}</span>
            </div>
            <div>
              <span className="text-green-600 dark:text-green-400">Удалено:</span>
              <span className="ml-2 font-medium text-green-800 dark:text-green-200">{lastResult.removed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Registered Bots List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Зарегистрированные боты ({bots?.length || 0})
            </h2>
          </div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {botsLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                    <div className="flex-1">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !bots || bots.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">Боты пока не зарегистрированы</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Запустите сканирование или добавьте бота вручную, чтобы начать
              </p>
            </div>
          ) : (
            bots.map((bot) => (
              <div
                key={bot.id}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <Link
                  to={`/bot/${bot.id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">
                      {bot.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {bot.name}
                      </p>
                      <StatusIndicator status={bot.health_state} size="sm" />
                      {bot.is_dryrun && (
                        <span className="px-1.5 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                          Dry
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {bot.exchange && <span>{bot.exchange}</span>}
                      {bot.strategy && <span> - {bot.strategy}</span>}
                      {bot.api_url && <span className="ml-2 text-gray-400">({bot.api_url})</span>}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-xs rounded ${getEnvironmentBadge(bot.environment)}`}>
                    {bot.environment}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {bot.last_seen ? formatDistanceToNow(new Date(bot.last_seen), { addSuffix: true }) : 'Никогда'}
                  </span>
                  <Link
                    to={`/bot/${bot.id}`}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${bot.name}"?`)) {
                        deleteBot.mutate(bot.id);
                      }
                    }}
                    disabled={deleteBot.isPending}
                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    title="Удалить бота"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Discovery Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Статус обнаружения
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Timing Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Последнее сканирование</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatDate(status?.last_scan || null)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Интервал сканирования</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatInterval(status?.scan_interval_seconds || 0)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Следующее сканирование</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    {formatDate(status?.next_scan || null)}
                  </p>
                </div>
              </div>

              {/* Discovery Sources */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Источники обнаружения
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Docker Source */}
                  <div className={`rounded-lg p-4 border-2 ${
                    status?.docker_enabled && status?.docker_available
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : status?.docker_enabled
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-white">Docker</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {status?.docker_enabled ? (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                            Включено
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                            Отключено
                          </span>
                        )}
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          status?.docker_available ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {status?.docker_enabled
                        ? status?.docker_available
                          ? 'Docker daemon подключен и сканирует контейнеры Freqtrade.'
                          : 'Docker включен, но daemon недоступен.'
                        : 'Обнаружение через Docker отключено.'}
                    </p>
                  </div>

                  {/* Filesystem Source */}
                  <div className={`rounded-lg p-4 border-2 ${
                    status?.filesystem_enabled && status?.filesystem_available
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : status?.filesystem_enabled
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-white">Filesystem</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {status?.filesystem_enabled ? (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                            Включено
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                            Отключено
                          </span>
                        )}
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          status?.filesystem_available ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {status?.filesystem_enabled
                        ? status?.filesystem_available
                          ? 'Сканер файловой системы активен и сканирует настроенные пути.'
                          : 'Файловая система включена, но валидные пути не найдены.'
                        : 'Обнаружение через файловую систему отключено.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Bot Registration Modal */}
      {showManualForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Добавить бота вручную
              </h3>
              <button
                onClick={() => {
                  setShowManualForm(false);
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Имя бота *
                </label>
                <input
                  type="text"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  placeholder="Мой торговый бот"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API URL *
                </label>
                <input
                  type="text"
                  value={manualForm.api_url}
                  onChange={(e) => setManualForm({ ...manualForm, api_url: e.target.value })}
                  placeholder="http://localhost:8080"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  URL API Freqtrade (например, http://localhost:8080)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Логин
                  </label>
                  <input
                    type="text"
                    value={manualForm.username}
                    onChange={(e) => setManualForm({ ...manualForm, username: e.target.value })}
                    placeholder="Необязательно"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={manualForm.password}
                    onChange={(e) => setManualForm({ ...manualForm, password: e.target.value })}
                    placeholder="Необязательно"
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false);
                    setFormError(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={addManualBot.isPending}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {addManualBot.isPending && (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  Добавить бота
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
