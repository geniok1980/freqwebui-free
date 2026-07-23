/**
 * Global Bot Search component with keyboard shortcut support.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useTranslation } from 'react-i18next';

interface Bot {
  id: string;
  name: string;
  environment: string;
  health_state: string;
  exchange: string | null;
  strategy: string | null;
  is_dryrun: boolean;
}

export function GlobalSearch() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Search query
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['bot-search', query],
    queryFn: async (): Promise<Bot[]> => {
      if (!query || query.length < 1) return [];
      const response = await api.get<Bot[]>(`/bots/search?q=${encodeURIComponent(query)}&limit=10`);
      return response.data;
    },
    enabled: query.length >= 1 && isOpen,
    staleTime: 30 * 1000,
  });

  const results = searchResults || [];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search with Ctrl+K or Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Navigation within results
  const handleKeyNavigation = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      }
    },
    [results, selectedIndex]
  );

  // Handle selection
  const handleSelect = (bot: Bot) => {
    setIsOpen(false);
    setQuery('');
    navigate(`/bots/${bot.id}`);
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const getHealthColor = (state: string) => {
    switch (state) {
      case 'healthy':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unreachable':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        title="Поиск ботов (Ctrl+K)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="hidden sm:inline">Поиск...</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded">
          Ctrl+K
        </kbd>
      </button>

      {/* Search Modal/Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={() => setIsOpen(false)} />

          {/* Search Panel */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyNavigation}
                  placeholder="Поиск ботов по имени, бирже или стратегии..."
                  className="flex-1 px-3 py-4 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
                  autoFocus
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : query.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <p className="text-sm">Начните ввод для поиска ботов...</p>
                    <p className="text-xs mt-2">Поиск по имени, бирже или стратегии</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <svg className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium">Боты не найдены</p>
                    <p className="text-xs mt-1">Нет результатов для "{query}"</p>
                  </div>
                ) : (
                  <ul className="py-2">
                    {results.map((bot, index) => (
                      <li key={bot.id}>
                        <button
                          onClick={() => handleSelect(bot)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                            index === selectedIndex
                              ? 'bg-blue-50 dark:bg-blue-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          {/* Health indicator */}
                          <div className={`w-2 h-2 rounded-full ${getHealthColor(bot.health_state)}`} />

                          {/* Bot info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white truncate">
                                {bot.name}
                              </span>
                              {bot.is_dryrun && (
                                <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded">
                                  Демо
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {bot.exchange && <span>{bot.exchange}</span>}
                              {bot.exchange && bot.strategy && <span> / </span>}
                              {bot.strategy && <span>{bot.strategy}</span>}
                            </div>
                          </div>

                          {/* Environment badge */}
                          <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                            {bot.environment}
                          </span>

                          {/* Arrow */}
                          {index === selectedIndex && (
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd>
                  <span>выбрать</span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd>
                  <span>закрыть</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
