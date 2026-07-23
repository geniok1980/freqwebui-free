import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { strategyLabApi } from '../../services/strategyLabApi';
import { Card } from '../../components/common/Card';
import { useTranslation } from 'react-i18next';

interface Strategy {
  name: string;
  family?: string;
  version?: string;
  file_path?: string;
}

export function StrategyList() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [uploadFamily, setUploadFamily] = useState('Custom');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: strategies = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => strategyLabApi.getStrategies() as Promise<Strategy[]>,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error('Файл не выбран');
      setUploadError(null);
      await strategyLabApi.uploadStrategy(uploadFile, uploadFamily);
    },
    onSuccess: async () => {
      setUploadFile(null);
      await queryClient.invalidateQueries({ queryKey: ['strategies'] });
    },
    onError: (e: any) => {
      setUploadError(e?.message || 'Не удалось загрузить стратегию');
    },
  });

  const families = useMemo(() => {
    return ['all', ...new Set(strategies.map((s) => s.family).filter(Boolean) as string[])];
  }, [strategies]);

  const filtered = useMemo(() => {
    return strategies.filter((s) => {
      const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
      const matchesFamily = selectedFamily === 'all' || s.family === selectedFamily;
      return matchesSearch && matchesFamily;
    });
  }, [strategies, search, selectedFamily]);

  // Group by family
  const grouped = filtered.reduce((acc, s) => {
    const family = s.family || 'Другое';
    if (!acc[family]) acc[family] = [];
    acc[family].push(s);
    return acc;
  }, {} as Record<string, Strategy[]>);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📋 Стратегии</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{strategies.length} стратегий доступно для оптимизации</p>
        </div>
        <Link to="/strategy-lab" className="text-blue-600 dark:text-blue-400 hover:text-blue-700">
          ← Назад в лабораторию стратегий
        </Link>
      </div>

      {/* Upload */}
      <Card className="mb-6 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Загрузка стратегии
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Загрузите готовый файл стратегии (.py) в папку Strategies
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Файл стратегии (.py)
            </label>
            <input
              type="file"
              accept=".py"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {uploadFile && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Выбрано: <span className="font-mono">{uploadFile.name}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Папка (family)
            </label>
            <input
              type="text"
              value={uploadFamily}
              onChange={(e) => setUploadFamily(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Custom"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {uploadError ? <span className="text-red-500">{uploadError}</span> : null}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setUploadFile(null);
                setUploadError(null);
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
            >
              Сбросить
            </button>
            <button
              type="button"
              disabled={!uploadFile || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            >
              {uploadMutation.isPending ? 'Загрузка...' : 'Загрузить'}
            </button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Поиск стратегий..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={selectedFamily}
          onChange={(e) => setSelectedFamily(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {families.map(f => (
            <option key={f} value={f}>
              {f === 'all' ? 'Все семейства' : f}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="p-6 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Загрузка стратегий...</p>
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6 text-center text-red-500">
          {(error as Error)?.message || 'Не удалось загрузить стратегии'}
        </div>
      )}

      {/* Strategy Cards by Family */}
      {!isLoading && !isError && <div className="space-y-6">
        {Object.entries(grouped).map(([family, familyStrategies]) => (
          <div key={family}>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              {family}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({familyStrategies.length})</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {familyStrategies.map(strategy => (
                <div key={strategy.name} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{strategy.name}</h3>
                      {strategy.version && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs rounded">
                          {strategy.version}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl">🤖</span>
                  </div>
                  
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 truncate" title={strategy.file_path}>
                    {strategy.file_path?.split('/').slice(-3).join('/')}
                  </p>
                  
                  <div className="flex gap-2 mt-4">
                    <Link
                      to={`/strategy-lab/workflow?strategy=${strategy.name}&steps=backtest`}
                      className="flex-1 text-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                    >
                      📊 Бэктест
                    </Link>
                    <Link
                      to={`/strategy-lab/hyperopt/${strategy.name}`}
                      className="flex-1 text-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
                    >
                      🔍 Гиперопт
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Нет стратегий по выбранным фильтрам
        </div>
      )}
    </div>
  );
}
