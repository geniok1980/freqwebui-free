import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Strategy {
  name: string;
  family?: string;
  version?: string;
  file_path?: string;
}

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

export function StrategyList() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('all');

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    fetch(`${API_BASE}/strategy-lab/strategies`, {
      headers: {'Authorization': 'Bearer ' + token}
    })
    .then(r => r.json())
    .then(data => {
      setStrategies(data || []);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-500">Загрузка стратегий...</p>
      </div>
    </div>
  );

  // Get unique families
  const families = ['all', ...new Set(strategies.map(s => s.family).filter(Boolean))];

  // Filter strategies
  const filtered = strategies.filter(s => {
    const matchesSearch = !search || s.name.toLowerCase().includes(search.toLowerCase());
    const matchesFamily = selectedFamily === 'all' || s.family === selectedFamily;
    return matchesSearch && matchesFamily;
  });

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

      {/* Strategy Cards by Family */}
      <div className="space-y-6">
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
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Нет стратегий по выбранным фильтрам
        </div>
      )}
    </div>
  );
}
