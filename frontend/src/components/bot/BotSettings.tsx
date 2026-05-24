/**
 * Bot settings component for editing bot configuration.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateBot, useDeleteBot } from '../../hooks/useBots';
import { api } from '../../services/api';
import type { Bot, SourceMode } from '../../types';

interface BotSettingsProps {
  bot: Bot & {
    container_id?: string;
    user_data_path?: string;
    discovered_at: string;
    created_at: string;
  };
}

const sourceModes: { value: SourceMode; label: string; description: string }[] = [
  { value: 'auto', label: 'Авто (предпочтительно API)', description: 'Использовать API, при недоступности — SQLite' },
  { value: 'api', label: 'Только API', description: 'Использовать только REST API для данных' },
  { value: 'sqlite', label: 'Только SQLite', description: 'Использовать только SQLite базу' },
  { value: 'mixed', label: 'Смешанный режим', description: 'Использовать API с fallback на SQLite' },
];

export function BotSettings({ bot }: BotSettingsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateBot = useUpdateBot();
  const deleteBot = useDeleteBot();

  const [name, setName] = useState(bot.name);
  const [tags, setTags] = useState(bot.tags.join(', '));
  const [sourceMode, setSourceMode] = useState<SourceMode>(bot.source_mode);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // API Credentials state
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsSuccess, setCredentialsSuccess] = useState<string | null>(null);

  const updateCredentials = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const response = await api.put(`/bots/${bot.id}/credentials`, { username, password });
      return response.data;
    },
    onSuccess: (data: any) => {
      if (data.api_available) {
        setCredentialsSuccess(data.message);
        setCredentialsError(null);
        setShowCredentialsForm(false);
        setUsername('');
        setPassword('');
        // Refresh bot data
        queryClient.invalidateQueries({ queryKey: ['bot', bot.id] });
        queryClient.invalidateQueries({ queryKey: ['bot', bot.id, 'health'] });
      } else {
        setCredentialsError(data.message);
        setCredentialsSuccess(null);
      }
    },
    onError: (error: any) => {
      setCredentialsError(error.message || 'Не удалось обновить учетные данные');
      setCredentialsSuccess(null);
    },
  });

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setCredentialsError('Требуются логин и пароль');
      return;
    }
    setCredentialsError(null);
    updateCredentials.mutate({ username, password });
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setHasChanges(true);
  };

  const handleTagsChange = (value: string) => {
    setTags(value);
    setHasChanges(true);
  };

  const handleSourceModeChange = (value: SourceMode) => {
    setSourceMode(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await updateBot.mutateAsync({
      botId: bot.id,
      update: {
        name: name !== bot.name ? name : undefined,
        tags: tagList,
        source_mode: sourceMode !== bot.source_mode ? sourceMode : undefined,
      },
    });

    setHasChanges(false);
  };

  const handleDelete = async () => {
    await deleteBot.mutateAsync(bot.id);
    navigate('/');
  };

  const handleReset = () => {
    setName(bot.name);
    setTags(bot.tags.join(', '));
    setSourceMode(bot.source_mode);
    setHasChanges(false);
  };

  return (
    <div className="space-y-8">
      {/* General Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Общие настройки
        </h3>
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Отображаемое имя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Имя бота"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Удобное имя бота в дашборде.
            </p>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Теги
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => handleTagsChange(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="prod, btc, scalping"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Теги через запятую для организации и фильтрации ботов.
            </p>
          </div>
        </div>
      </div>

      {/* Data Source Settings */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Источник данных
        </h3>
        <div className="space-y-3">
          {sourceModes.map((mode) => (
            <label
              key={mode.value}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                sourceMode === mode.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="sourceMode"
                value={mode.value}
                checked={sourceMode === mode.value}
                onChange={() => handleSourceModeChange(mode.value)}
                className="mt-1"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{mode.label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{mode.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* API Credentials Section */}
      {bot.api_url && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            API подключение
          </h3>

          {credentialsSuccess && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-200">
              {credentialsSuccess}
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">URL API</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{bot.api_url}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  bot.health_state === 'healthy' ? 'bg-green-500' :
                  bot.health_state === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></span>
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {bot.health_state}
                </span>
              </div>
            </div>

            {bot.health_state !== 'healthy' && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Обнаружена проблема подключения к API. Если ошибка в авторизации, обновите учетные данные ниже.
                </p>
              </div>
            )}

            {!showCredentialsForm ? (
              <button
                onClick={() => setShowCredentialsForm(true)}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Обновить учетные данные API
              </button>
            ) : (
              <form onSubmit={handleCredentialsSubmit} className="mt-4 space-y-3">
                {credentialsError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200">
                    {credentialsError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Логин
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="freqtrade"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Пароль
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="********"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={updateCredentials.isPending}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {updateCredentials.isPending && (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    Проверить и сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCredentialsForm(false);
                      setCredentialsError(null);
                      setUsername('');
                      setPassword('');
                    }}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Save/Reset Buttons */}
      {hasChanges && (
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={updateBot.isPending}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateBot.isPending ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
          <button
            onClick={handleReset}
            disabled={updateBot.isPending}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Сбросить
          </button>
          {updateBot.isError && (
            <p className="text-sm text-red-500 dark:text-red-400">
              Не удалось сохранить изменения. Попробуйте снова.
            </p>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-4">
          Опасная зона
        </h3>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Удалить бота</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Удаляет бота из дашборда. Сам бот не останавливается и не изменяется —
                он просто убирается из мониторинга. При следующем сканировании бот может появиться снова.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap ml-4"
            >
              Удалить бота
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Удалить бота?
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Вы уверены, что хотите удалить <strong>{bot.name}</strong> из дашборда?
              Это действие нельзя отменить, но бот может быть найден снова при следующем сканировании.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteBot.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteBot.isPending ? 'Удаление...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
