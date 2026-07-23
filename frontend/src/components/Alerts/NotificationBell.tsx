/**
 * Notification Bell component with alerts dropdown.
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
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

interface AlertCounts {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch alert counts
  const { data: counts } = useQuery({
    queryKey: ['alerts', 'count'],
    queryFn: async (): Promise<AlertCounts> => {
      const response = await api.get<{ data: AlertCounts }>('/alerts/count');
      return response.data?.data || { total: 0, unread: 0, critical: 0, warning: 0, info: 0 };
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  // Fetch recent alerts
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts', 'recent'],
    queryFn: async () => {
      const response = await api.get<{ data: Alert[]; total: number; unread_count: number }>('/alerts?limit=10&unread_only=false');
      // Handle different response structures
      if (response.data && Array.isArray(response.data)) {
        // Direct array response
        return { data: response.data as Alert[], total: response.data.length, unread_count: 0 };
      } else if (response.data && response.data.data) {
        // Nested response
        return response.data;
      }
      return { data: [], total: 0, unread_count: 0 };
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    enabled: isOpen,
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/alerts/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Mark single alert as read
  const markReadMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      await api.post('/alerts/mark-read', { alert_ids: alertIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Dismiss alert
  const dismissMutation = useMutation({
    mutationFn: async (alertIds: string[]) => {
      await api.post('/alerts/dismiss', { alert_ids: alertIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = counts?.unread || 0;
  const hasCritical = (counts?.critical || 0) > 0;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isOpen
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        title={`${unreadCount} непрочитанных уведомлений`}
      >
        <svg
          className={`w-6 h-6 ${hasCritical ? 'text-red-500 animate-pulse' : 'text-gray-600 dark:text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold text-white rounded-full ${
              hasCritical ? 'bg-red-500' : 'bg-blue-500'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Уведомления
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                disabled={markAllReadMutation.isPending}
              >
                Прочитать все
              </button>
            )}
          </div>

          {/* Alerts List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              </div>
            ) : !alertsData?.data || alertsData.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-sm">Уведомлений нет</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {alertsData?.data.map((alert) => (
                  <li
                    key={alert.id}
                    className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !alert.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => {
                      if (!alert.is_read) {
                        markReadMutation.mutate([alert.id]);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {alert.title}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissMutation.mutate([alert.id]);
                            }}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                            title="Скрыть"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {alert.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Footer */}
          {alertsData && alertsData.total > 10 && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Всего уведомлений: {alertsData.total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
