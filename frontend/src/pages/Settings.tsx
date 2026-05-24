/**
 * Settings page - Cleaned: UnifiedSettings at top, old user prefs removed
 */

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { api } from '../services/api';
import { toast } from '../components/common/Toast';
import { format } from 'date-fns';
import { UnifiedSettings } from '../components/settings/UnifiedSettings';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function arrayToCSV(data: Record<string, unknown>[], headers: string[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      const str = value === null || value === undefined ? '' : String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [headerRow, ...rows].join('\n');
}

export function Settings() {
  const { user, refreshUser } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isExporting, setIsExporting] = useState<string | null>(null);

  useEffect(() => {
    refreshUser();
  }, []);

  const changePassword = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const response = await api.patch('/users/me/password', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Пароль успешно изменен');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Не удалось изменить пароль');
    },
  });

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Минимум 8 символов');
    if (!/[A-Z]/.test(password)) errors.push('Одна заглавная буква');
    if (!/[a-z]/.test(password)) errors.push('Одна строчная буква');
    if (!/[0-9]/.test(password)) errors.push('Одна цифра');
    return { valid: errors.length === 0, errors };
  };

  const passwordValidation = validatePassword(newPassword);
  const passwordStrength = newPassword.length === 0 ? 0 :
    passwordValidation.valid ? 4 :
    4 - passwordValidation.errors.length;

  const handleChangePassword = () => {
    if (!currentPassword) {
      toast.error('Требуется текущий пароль');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }
    if (!passwordValidation.valid) {
      toast.error('Пароль не соответствует требованиям');
      return;
    }
    changePassword.mutate({
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const handleExportBots = async () => {
    setIsExporting('bots');
    try {
      const response = await api.get<any[]>('/bots');
      const bots = response.data || [];

      if (bots.length === 0) {
        toast.info('Нет ботов для экспорта');
        return;
      }

      const exportData = bots.map(bot => ({
        id: bot.id,
        name: bot.name,
        environment: bot.environment,
        health_state: bot.health_state,
        exchange: bot.exchange || '',
        strategy: bot.strategy || '',
        is_dryrun: bot.is_dryrun ? 'Да' : 'Нет',
        api_url: bot.api_url || '',
        tags: (bot.tags || []).join(';'),
        last_seen: bot.last_seen || '',
        created_at: bot.created_at || '',
      }));

      const headers = ['id', 'name', 'environment', 'health_state', 'exchange', 'strategy', 'is_dryrun', 'api_url', 'tags', 'last_seen', 'created_at'];
      const csv = arrayToCSV(exportData, headers);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      downloadFile(csv, `bots_export_${timestamp}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`Экспортировано ботов: ${bots.length}`);
    } catch (error) {
      toast.error('Не удалось экспортировать ботов');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportTrades = async () => {
    setIsExporting('trades');
    try {
      const botsResponse = await api.get<any[]>('/bots');
      const bots = botsResponse.data || [];

      const allTrades: any[] = [];
      for (const bot of bots) {
        try {
          const tradesResponse = await api.get<any[]>(`/bots/${bot.id}/trades`);
          const trades = tradesResponse.data || [];
          trades.forEach(trade => {
            allTrades.push({
              bot_id: bot.id,
              bot_name: bot.name,
              trade_id: trade.id,
              pair: trade.pair,
              side: trade.is_short ? 'ШОРТ' : 'ЛОНГ',
              leverage: trade.leverage || 1,
              open_date: trade.open_date,
              close_date: trade.close_date || '',
              open_rate: trade.open_rate,
              close_rate: trade.close_rate || '',
              stake_amount: trade.stake_amount || '',
              amount: trade.amount || '',
              profit_pct: trade.close_profit !== undefined ? (trade.close_profit * 100).toFixed(4) : '',
              profit_abs: trade.close_profit_abs || '',
              exit_reason: trade.exit_reason || '',
              is_open: trade.is_open ? 'Да' : 'Нет',
            });
          });
        } catch {
          // Skip bots that fail to fetch trades
        }
      }

      if (allTrades.length === 0) {
        toast.info('Нет сделок для экспорта');
        return;
      }

      const headers = ['bot_id', 'bot_name', 'trade_id', 'pair', 'side', 'leverage', 'open_date', 'close_date', 'open_rate', 'close_rate', 'stake_amount', 'amount', 'profit_pct', 'profit_abs', 'exit_reason', 'is_open'];
      const csv = arrayToCSV(allTrades, headers);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      downloadFile(csv, `trades_export_${timestamp}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`Экспортировано сделок: ${allTrades.length} из ${bots.length} ботов`);
    } catch (error) {
      toast.error('Не удалось экспортировать сделки');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportAlerts = async () => {
    setIsExporting('alerts');
    try {
      const response = await api.get<{ data: any[] }>('/alerts?limit=1000');
      const alerts = response.data?.data || [];

      if (alerts.length === 0) {
        toast.info('Нет алертов для экспорта');
        return;
      }

      const exportData = alerts.map(alert => ({
        id: alert.id,
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        bot_id: alert.bot_id,
        bot_name: alert.bot_name,
        is_read: alert.is_read,
        is_dismissed: alert.is_dismissed,
        created_at: alert.created_at,
      }));

      const json = JSON.stringify(exportData, null, 2);
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      downloadFile(json, `alerts_export_${timestamp}.json`, 'application/json');
      toast.success(`Экспортировано алертов: ${alerts.length}`);
    } catch (error) {
      toast.error('Не удалось экспортировать алерты');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Настройки</h1>

      {/* Unified Settings - Refresh, Theme, Discovery (ONE Save button) */}
      <UnifiedSettings />

      {/* Change Password Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Смена пароля
        </h2>

        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Текущий пароль
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Новый пароль
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            />
            {newPassword.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded ${
                        passwordStrength >= level
                          ? passwordStrength >= 4
                            ? 'bg-green-500'
                            : passwordStrength >= 3
                            ? 'bg-yellow-500'
                            : passwordStrength >= 2
                            ? 'bg-orange-500'
                            : 'bg-red-500'
                          : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs ${passwordValidation.valid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {passwordValidation.valid
                    ? 'Пароль соответствует всем требованиям'
                    : `Не хватает: ${passwordValidation.errors.join(', ')}`}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Подтвердите новый пароль
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`block w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 ${
                confirmPassword.length > 0 && newPassword !== confirmPassword
                  ? 'border-red-500 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">Пароли не совпадают</p>
            )}
            {confirmPassword.length > 0 && newPassword === confirmPassword && newPassword.length > 0 && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">Пароли совпадают</p>
            )}
          </div>

          <button
            onClick={handleChangePassword}
            disabled={changePassword.isPending || !currentPassword || !newPassword}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
          >
            {changePassword.isPending ? 'Изменение...' : 'Изменить пароль'}
          </button>
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Информация об аккаунте
        </h2>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Логин</p>
            <p className="text-gray-900 dark:text-white font-medium">{user?.username}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Роль</p>
            <p className="text-gray-900 dark:text-white font-medium capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Data Export Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Экспорт данных
        </h2>

        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Экспортируйте данные ботов и историю сделок для анализа или резервного копирования.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportBots}
              disabled={isExporting === 'bots'}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting === 'bots' ? 'Экспорт...' : 'Экспорт ботов (CSV)'}
            </button>

            <button
              onClick={handleExportTrades}
              disabled={isExporting === 'trades'}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting === 'trades' ? 'Экспорт...' : 'Экспорт сделок (CSV)'}
            </button>

            <button
              onClick={handleExportAlerts}
              disabled={isExporting === 'alerts'}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting === 'alerts' ? 'Экспорт...' : 'Экспорт алертов (JSON)'}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Горячие клавиши
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Поиск ботов</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+K</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Сменить тему</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Ctrl+Shift+T</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Перейти к дашборду</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">G then D</kbd>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Перейти в настройки</span>
            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">G then S</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
