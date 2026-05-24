import { useState, useMemo } from 'react';
import { useBots } from '../../hooks/useBots';
import { useBotStore, getActiveFilterCount } from '../../store/botStore';
import type { BotEnvironment, HealthState } from '../../types';

export function BotFilters() {
  // Fetch ALL bots (unfiltered) for filter options and counts
  const { data: bots = [] } = useBots();
  const { filters, setFilter, clearFilters, viewMode, setViewMode, sortBy, setSortBy, sortOrder, setSortOrder } =
    useBotStore();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activeFilterCount = getActiveFilterCount(filters);

  // Extract unique exchanges, strategies, and tags from bots
  const filterOptions = useMemo(() => {
    const exchanges = new Set<string>();
    const strategies = new Set<string>();
    const tags = new Set<string>();

    bots.forEach(bot => {
      if (bot.exchange) exchanges.add(bot.exchange);
      if (bot.strategy) strategies.add(bot.strategy);
      bot.tags?.forEach(tag => tags.add(tag));
    });

    return {
      exchanges: Array.from(exchanges).sort(),
      strategies: Array.from(strategies).sort(),
      tags: Array.from(tags).sort(),
    };
  }, [bots]);

  // Count bots per filter option
  const filterCounts = useMemo(() => {
    const counts = {
      environments: {} as Record<string, number>,
      healthStates: {} as Record<string, number>,
      exchanges: {} as Record<string, number>,
      strategies: {} as Record<string, number>,
      tags: {} as Record<string, number>,
    };

    bots.forEach(bot => {
      // Environment
      counts.environments[bot.environment] = (counts.environments[bot.environment] || 0) + 1;
      // Health
      counts.healthStates[bot.health_state] = (counts.healthStates[bot.health_state] || 0) + 1;
      // Exchange
      if (bot.exchange) {
        counts.exchanges[bot.exchange] = (counts.exchanges[bot.exchange] || 0) + 1;
      }
      // Strategy
      if (bot.strategy) {
        counts.strategies[bot.strategy] = (counts.strategies[bot.strategy] || 0) + 1;
      }
      // Tags
      bot.tags?.forEach(tag => {
        counts.tags[tag] = (counts.tags[tag] || 0) + 1;
      });
    });

    return counts;
  }, [bots]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Поиск ботов..."
            value={filters.search || ''}
            onChange={(e) => setFilter('search', e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Environment Filter */}
        <select
          value={filters.environment || ''}
          onChange={(e) =>
            setFilter(
              'environment',
              (e.target.value as BotEnvironment) || undefined
            )
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все окружения</option>
          <option value="docker">Docker</option>
          <option value="baremetal">Без контейнера</option>
          <option value="k8s">Kubernetes</option>
          <option value="manual">Вручную</option>
        </select>

        {/* Health Filter */}
        <select
          value={filters.health_state || ''}
          onChange={(e) =>
            setFilter(
              'health_state',
              (e.target.value as HealthState) || undefined
            )
          }
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Все статусы</option>
          <option value="healthy">Здоров</option>
          <option value="degraded">Деградирован</option>
          <option value="unreachable">Недоступен</option>
        </select>

        {/* Sort By */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="name">Сортировать по имени</option>
          <option value="profit">Сортировать по прибыли</option>
          <option value="health">Сортировать по статусу</option>
          <option value="exchange">Сортировать по бирже</option>
          <option value="strategy">Сортировать по стратегии</option>
        </select>

        {/* Sort Order Toggle */}
        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
        >
          {sortOrder === 'asc' ? (
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
              />
            </svg>
          )}
        </button>

        {/* View Mode Toggle */}
        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${
              viewMode === 'grid'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
            title="Плитка"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${
              viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
            title="Список"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            Очистить ({activeFilterCount})
          </button>
        )}

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1"
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {showAdvanced ? 'Скрыть' : 'Больше'} фильтров
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Exchange Filter */}
            {filterOptions.exchanges.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Биржа
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filterOptions.exchanges.map(exchange => (
                    <label key={exchange} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded">
                      <input
                        type="radio"
                        name="exchange"
                        checked={filters.exchange === exchange}
                        onChange={() => setFilter('exchange', filters.exchange === exchange ? undefined : exchange)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{exchange}</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {filterCounts.exchanges[exchange] || 0}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy Filter */}
            {filterOptions.strategies.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Стратегия
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {filterOptions.strategies.map(strategy => (
                    <label key={strategy} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 px-2 py-1 rounded">
                      <input
                        type="radio"
                        name="strategy"
                        checked={filters.strategy === strategy}
                        onChange={() => setFilter('strategy', filters.strategy === strategy ? undefined : strategy)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 truncate" title={strategy}>
                        {strategy.length > 25 ? strategy.substring(0, 25) + '...' : strategy}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {filterCounts.strategies[strategy] || 0}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tags Filter */}
            {filterOptions.tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Теги
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {filterOptions.tags.map(tag => {
                    const isSelected = filters.tags?.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          const currentTags = filters.tags || [];
                          if (isSelected) {
                            const newTags = currentTags.filter(t => t !== tag);
                            setFilter('tags', newTags.length > 0 ? newTags : undefined);
                          } else {
                            setFilter('tags', [...currentTags, tag]);
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {tag} ({filterCounts.tags[tag] || 0})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Быстрая статистика
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                  <span className="text-green-700 dark:text-green-400 font-medium">
                    {filterCounts.healthStates['healthy'] || 0}
                  </span>
                  <span className="text-green-600 dark:text-green-500 ml-1">Здоров</span>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                  <span className="text-yellow-700 dark:text-yellow-400 font-medium">
                    {filterCounts.healthStates['degraded'] || 0}
                  </span>
                  <span className="text-yellow-600 dark:text-yellow-500 ml-1">Деградирован</span>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  <span className="text-red-700 dark:text-red-400 font-medium">
                    {filterCounts.healthStates['unreachable'] || 0}
                  </span>
                  <span className="text-red-600 dark:text-red-500 ml-1">Офлайн</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  <span className="text-blue-700 dark:text-blue-400 font-medium">
                    {bots.length}
                  </span>
                  <span className="text-blue-600 dark:text-blue-500 ml-1">Всего</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
