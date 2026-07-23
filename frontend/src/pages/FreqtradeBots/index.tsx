import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Monitor, 
  ExternalLink, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBots } from '../../hooks/useBots';
import { api } from '../../services/api';
import { strategyLabApi } from '../../services/strategyLabApi';
import type { Bot } from '../../types';
import { useTranslation } from 'react-i18next';

export function FreqtradeBots() {
  const { t } = useTranslation();
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);
  const queryClient = useQueryClient();

  const [showDeployForm, setShowDeployForm] = useState(false);
  const [deployName, setDeployName] = useState('');
  const [deployStrategy, setDeployStrategy] = useState('');
  const [deployPort, setDeployPort] = useState('8081');
  const [deployDryRun, setDeployDryRun] = useState(true);
  const [deployError, setDeployError] = useState<string | null>(null);
  
  const {
    data: allBots,
    isLoading: botsLoading,
    isError: botsIsError,
    error: botsError,
    refetch: refetchBots,
  } = useBots();

  const bots = useMemo(() => {
    return (allBots || []).filter((b) => !!b.api_url);
  }, [allBots]);

  const { data: strategies, isLoading: strategiesLoading } = useQuery({
    queryKey: ['strategy-lab', 'strategies'],
    queryFn: () => strategyLabApi.getStrategies(),
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!deployStrategy && strategies && strategies.length > 0) {
      setDeployStrategy(strategies[0].name);
    }
  }, [deployStrategy, strategies]);

  const deployBot = useMutation({
    mutationFn: async () => {
      const port = Number.parseInt(deployPort, 10);
      if (!deployName.trim()) throw new Error('Введите имя бота');
      if (!deployStrategy.trim()) throw new Error('Выберите стратегию');
      if (!Number.isFinite(port)) throw new Error('Неверный порт');

      const response = await api.post<Bot>('/bots/deploy', {
        name: deployName.trim(),
        strategy_name: deployStrategy.trim(),
        host_port: port,
        dry_run: deployDryRun,
      });

      return response.data;
    },
    onSuccess: (newBot) => {
      setShowDeployForm(false);
      setDeployError(null);
      setDeployName('');
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      if (newBot?.id) {
        setSelectedBot(newBot);
        setIsLoading(true);
        setIframeError(null);
      } else {
        refetchBots();
      }
    },
    onError: (err: any) => {
      setDeployError(err?.message || 'Не удалось развернуть бота');
    },
  });
  
  // Set first bot as default
  useEffect(() => {
    if (bots.length === 0) return;

    if (!selectedBot || !bots.some((b) => b.id === selectedBot.id)) {
      setSelectedBot(bots[0]);
      setIsLoading(true);
      setIframeError(null);
    }
  }, [bots, selectedBot]);
  
  const handleBotChange = (botId: string) => {
    const bot = bots.find((b) => b.id === botId);
    if (bot) {
      setSelectedBot(bot);
      setIsLoading(true);
      setIframeError(null);
    }
  };
  
  const uiUrl = useMemo(() => {
    if (!selectedBot?.api_url) return '';

    try {
      const url = new URL(selectedBot.api_url);

      if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === 'host.docker.internal'
      ) {
        url.hostname = window.location.hostname;
      }

      if (url.pathname === '/api/v1' || url.pathname === '/api/v1/') {
        url.pathname = '/';
      } else if (url.pathname.endsWith('/api/v1')) {
        url.pathname = url.pathname.slice(0, -'/api/v1'.length) || '/';
      } else if (url.pathname.endsWith('/api/v1/')) {
        url.pathname = url.pathname.slice(0, -'/api/v1/'.length) || '/';
      }

      url.hash = '';
      url.search = '';

      return url.toString();
    } catch {
      const raw = selectedBot.api_url.trim();
      if (raw && !raw.includes('://')) {
        return `http://${raw}`;
      }
      return raw;
    }
  }, [selectedBot?.api_url]);

  useEffect(() => {
    if (!selectedBot) return;

    setIsLoading(true);
    setIframeError(null);

    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
    }

    loadTimeoutRef.current = window.setTimeout(() => {
      setIsLoading(false);
      setIframeError('UI Freqtrade не удалось открыть во встроенном окне. Откройте его в новой вкладке.');
    }, 8000);

    return () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [selectedBot?.id]);
  
  return (
    <div className="flex flex-col bg-[#0f1419] h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)] overflow-hidden">
      {/* Compact Header */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-blue-500" />
          <h1 className="text-lg font-bold text-white">Боты Freqtrade</h1>
          
          {/* Bot Selector */}
          <select
            value={selectedBot?.id || ''}
            onChange={(e) => handleBotChange(e.target.value)}
            className="ml-2 px-3 py-1.5 bg-[#0f1419] border border-[#30363d] rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            disabled={botsLoading || botsIsError || bots.length === 0}
          >
            {bots.map((bot) => (
              <option key={bot.id} value={bot.id}>
                {bot.name}
              </option>
            ))}
          </select>
          
          {selectedBot?.strategy && (
            <span className="px-2 py-1 bg-blue-900 text-blue-200 rounded-full text-xs">
              {selectedBot.strategy}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDeployError(null);
              setShowDeployForm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Развернуть бота
          </button>
          {selectedBot && uiUrl && (
            <a
              href={uiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть UI
            </a>
          )}
          {selectedBot && (
            <Link
              to={`/bots/${selectedBot.id}`}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm rounded-lg transition-colors"
            >
              Настройки
            </Link>
          )}
        </div>
      </div>

      {showDeployForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Развернуть нового бота
              </h3>
              <button
                type="button"
                onClick={() => setShowDeployForm(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Имя бота
                </label>
                <input
                  value={deployName}
                  onChange={(e) => setDeployName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="bot2"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Допустимо: буквы/цифры, '-' и '_'
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Стратегия
                </label>
                <select
                  value={deployStrategy}
                  onChange={(e) => setDeployStrategy(e.target.value)}
                  disabled={strategiesLoading || !strategies || strategies.length === 0}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
                >
                  {(strategies || []).map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Порт (хост)
                  </label>
                  <input
                    value={deployPort}
                    onChange={(e) => setDeployPort(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="8081"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
                    <input
                      type="checkbox"
                      checked={deployDryRun}
                      onChange={(e) => setDeployDryRun(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    Dry run
                  </label>
                </div>
              </div>

              {deployError && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {deployError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeployForm(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeployError(null);
                    deployBot.mutate();
                  }}
                  disabled={deployBot.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deployBot.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Разворачиваем...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Развернуть
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Iframe Container - Full width/height */}
      <div className="flex-1 relative bg-[#0f1419] overflow-hidden">
        {botsLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1419] z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-500">Загрузка ботов из базы данных...</p>
            </div>
          </div>
        )}

        {!botsLoading && botsIsError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1419] z-10 px-6">
            <div className="text-center max-w-xl">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50 text-gray-500" />
              <p className="text-gray-200">Не удалось загрузить список ботов</p>
              <p className="text-sm mt-2 text-gray-500">{(botsError as Error)?.message || String(botsError)}</p>
              <button
                type="button"
                onClick={() => refetchBots()}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Повторить
              </button>
            </div>
          </div>
        )}

        {!botsLoading && !botsIsError && bots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1419] z-10">
            <div className="text-center text-gray-500">
              <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Боты с настроенным api_url не найдены</p>
              <p className="text-sm mt-2">Проверьте настройку API сервера в Freqtrade и “Обнаружение” в дашборде</p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1419] z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-500">Загрузка UI {selectedBot?.name}...</p>
            </div>
          </div>
        )}

        {!isLoading && iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0f1419] z-10 px-6">
            <div className="text-center max-w-xl">
              <p className="text-gray-300">{iframeError}</p>
              {uiUrl && (
                <a
                  href={uiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть UI в новой вкладке
                </a>
              )}
            </div>
          </div>
        )}
        
        {!botsLoading && !botsIsError && selectedBot && uiUrl && (
          <iframe
            key={selectedBot.id}
            src={uiUrl}
            className="w-full h-full border-0"
            onLoad={() => {
              if (loadTimeoutRef.current) {
                window.clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
              }
              setIsLoading(false);
              setIframeError(null);
            }}
            onError={() => {
              if (loadTimeoutRef.current) {
                window.clearTimeout(loadTimeoutRef.current);
                loadTimeoutRef.current = null;
              }
              setIsLoading(false);
              setIframeError('UI Freqtrade не удалось загрузить. Откройте его в новой вкладке.');
            }}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            title={`Freqtrade ${selectedBot.name}`}
          />
        )}
      </div>
    </div>
  );
}
