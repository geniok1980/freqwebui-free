/**
 * Bot detail page with tabbed interface.
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBot, useBotMetrics, useBotHealth, useBotStatus } from '../hooks/useBots';
import { api } from '../services/api';
import { StatusIndicator } from '../components/common/StatusIndicator';
import { BotOverview } from '../components/bot/BotOverview';
import { BotTrades } from '../components/bot/BotTrades';
import { BotHealthPanel } from '../components/bot/BotHealthPanel';
import { BotSettings } from '../components/bot/BotSettings';
import { BotControls } from '../components/bot/BotControls';
import { BotAnalytics } from '../components/bot/BotAnalytics';

/**
 * Convert bot API URL to use current browser hostname instead of localhost.
 */
function getFreqUIUrl(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    const url = new URL(apiUrl);
    // Replace localhost/127.0.0.1 with current browser hostname
    if (
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === 'host.docker.internal'
    ) {
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return apiUrl;
  }
}

type TabId = 'overview' | 'trades' | 'analytics' | 'health' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const tabs: Tab[] = [
  {
    id: 'overview',
    label: 'Обзор',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'trades',
    label: 'Сделки',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Аналитика',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'health',
    label: 'Состояние',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Настройки',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function BotDetail() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const { data: bot, isLoading: botLoading, error: botError } = useBot(botId || '');
  const { data: metrics, isLoading: metricsLoading } = useBotMetrics(botId || '');
  const { data: health, isLoading: healthLoading } = useBotHealth(botId || '');
  const apiAvailable = bot?.api_url && bot?.health_state !== 'unreachable';
  const { data: botStatus } = useBotStatus(botId || '', !!apiAvailable);

  const deleteBot = useMutation({
    mutationFn: async () => {
      const response = await api.delete(`/bots/${botId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      navigate('/');
    },
    onError: (error: any) => {
      alert(error.message || 'Не удалось удалить бота');
    },
  });

  if (botLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (botError || !bot) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Бот не найден
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Бот, который вы ищете, не существует или уже удален.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          Назад к дашборду
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-sm">
        <Link to="/" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          Дашборд
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 dark:text-white">{bot.name}</span>
      </nav>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">
                {bot.name.substring(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                {bot.name}
                <StatusIndicator status={bot.health_state} size="md" />
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="capitalize">{bot.environment}</span>
                </span>
                {bot.exchange && (
                  <>
                    <span>•</span>
                    <span>{bot.exchange}</span>
                  </>
                )}
                {bot.strategy && (
                  <>
                    <span>•</span>
                    <span>{bot.strategy}</span>
                  </>
                )}
                {bot.is_dryrun && (
                  <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                    Демо
                  </span>
                )}
                {getFreqUIUrl(bot.api_url) && (
                  <a
                    href={getFreqUIUrl(bot.api_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    FreqUI
                  </a>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Удалить "${bot.name}"?\n\nБот будет удален только из дашборда и продолжит работать.`)) {
                      deleteBot.mutate();
                    }
                  }}
                  disabled={deleteBot.isPending}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Удалить
                </button>
              </div>
            </div>
          </div>

          {/* Quick metrics */}
          {metrics && (
            <div className="hidden md:flex items-center gap-6 text-right">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Прибыль</p>
                <p className={`text-lg font-semibold ${
                  (metrics.profit_pct ?? 0) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {(metrics.profit_pct ?? 0).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Открыто</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {metrics.open_positions}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Сделки</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {metrics.closed_trades}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bot Controls */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <BotControls
            botId={botId || ''}
            botState={botStatus?.state}
            hasOpenTrades={(metrics?.open_positions ?? 0) > 0}
            apiAvailable={!!apiAvailable}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {bot.api_url ? (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                API подключен
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                Нет подключения к API
              </span>
            )}
          </div>
        </div>

        {/* Tags */}
        {bot.tags && bot.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {bot.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <BotOverview
              bot={bot}
              metrics={metrics}
              isLoading={metricsLoading}
            />
          )}
          {activeTab === 'trades' && (
            <BotTrades botId={botId || ''} />
          )}
          {activeTab === 'analytics' && (
            <BotAnalytics botId={botId || ''} />
          )}
          {activeTab === 'health' && (
            <BotHealthPanel
              botId={botId || ''}
              health={health}
              isLoading={healthLoading}
            />
          )}
          {activeTab === 'settings' && (
            <BotSettings bot={bot} />
          )}
        </div>
      </div>
    </div>
  );
}
