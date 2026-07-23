/**
 * Full Alerts page with filtering, pagination, and bulk actions.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  bot_id: string | null;
  bot_name: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

interface AlertsResponse {
  data: Alert[];
  total: number;
  unread_count: number;
}

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';
type StatusFilter = 'all' | 'unread' | 'read';

export function Alerts() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const limit = 20;

  // Build query params
  const queryParams = new URLSearchParams({
    limit: limit.toString(),
    offset: ((page - 1) * limit).toString(),
  });
  if (severityFilter !== 'all') {
    queryParams.append('severity', severityFilter);
  }
  if (statusFilter === 'unread') {
    queryParams.append('unread_only', 'true');
  }

  // Fetch alerts
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', 'list', page, severityFilter, statusFilter],
    queryFn: async (): Promise<AlertsResponse> => {
      const response = await api.get<{ data: Alert[]; total: number; unread_count: number }>(
        `/alerts?${queryParams.toString()}`
      );
      return response.data || { data: [], total: 0, unread_count: 0 };
    },
    staleTime: 10 * 1000,
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      await api.post('/alerts/mark-read', { alert_ids: alertIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setSelectedAlerts(new Set());
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      await api.post('/alerts/dismiss', { alert_ids: alertIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      setSelectedAlerts(new Set());
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/alerts/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const alerts = alertsData?.data || [];
  const total = alertsData?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const toggleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map((a) => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAlerts(newSelected);
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-800 dark:text-red-200',
          icon: (
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ),
        };
      case 'warning':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: (
            <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          ),
        };
      default:
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-800 dark:text-blue-200',
          icon: (
            <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          ),
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Алерты</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {total} всего алертов, {alertsData?.unread_count || 0} непрочитано
          </p>
        </div>
        <button
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending || (alertsData?.unread_count || 0) === 0}
          className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Прочитать все
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Важность
            </label>
            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value as SeverityFilter);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Все</option>
              <option value="critical">Критично</option>
              <option value="warning">Предупреждение</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Статус
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">Все</option>
              <option value="unread">Только непрочитанные</option>
              <option value="read">Прочитанные</option>
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedAlerts.size > 0 && (
            <div className="flex items-end gap-2 ml-auto">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Выбрано: {selectedAlerts.size}
              </span>
              <button
                onClick={() => markReadMutation.mutate(Array.from(selectedAlerts))}
                disabled={markReadMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50"
              >
                Прочитать
              </button>
              <button
                onClick={() => dismissMutation.mutate(Array.from(selectedAlerts))}
                disabled={dismissMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50"
              >
                Скрыть
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Alerts List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <p className="text-lg font-medium">Алерты не найдены</p>
            <p className="text-sm">Попробуйте изменить фильтры</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={selectedAlerts.size === alerts.length && alerts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </div>
              <div className="col-span-1">Важность</div>
              <div className="col-span-4">Алерт</div>
              <div className="col-span-2">Бот</div>
              <div className="col-span-2">Время</div>
              <div className="col-span-2">Действия</div>
            </div>

            {/* Alert Rows */}
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {alerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity);
                return (
                  <li
                    key={alert.id}
                    className={`px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !alert.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center">
                      {/* Checkbox */}
                      <div className="hidden md:block col-span-1">
                        <input
                          type="checkbox"
                          checked={selectedAlerts.has(alert.id)}
                          onChange={() => toggleSelect(alert.id)}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      </div>

                      {/* Severity */}
                      <div className="hidden md:flex md:col-span-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
                          {alert.severity}
                        </span>
                      </div>

                      {/* Alert Content */}
                      <div className="col-span-4 mb-2 md:mb-0">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 md:hidden">{styles.icon}</div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {alert.title}
                              {!alert.is_read && (
                                <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-blue-500"></span>
                              )}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {alert.message}
                            </p>
                            <span className={`md:hidden inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
                              {alert.severity}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bot */}
                      <div className="col-span-2 text-sm text-gray-500 dark:text-gray-400 mb-2 md:mb-0">
                        {alert.bot_id ? (
                          <Link
                            to={`/bots/${alert.bot_id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {alert.bot_name || 'Неизвестный бот'}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Система</span>
                        )}
                      </div>

                      {/* Time */}
                      <div className="col-span-2 text-sm text-gray-500 dark:text-gray-400 mb-2 md:mb-0">
                        <span title={format(new Date(alert.created_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center gap-2">
                        {!alert.is_read && (
                          <button
                            onClick={() => markReadMutation.mutate([alert.id])}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            Прочитать
                          </button>
                        )}
                        <button
                          onClick={() => dismissMutation.mutate([alert.id])}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          Скрыть
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Показано {(page - 1) * limit + 1}–{Math.min(page * limit, total)} из {total} алертов
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Назад
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Страница {page} из {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Вперед
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
