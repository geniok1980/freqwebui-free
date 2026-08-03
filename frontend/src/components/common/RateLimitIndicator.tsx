import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useRateLimits } from '../../hooks/useRateLimits';

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

export function RateLimitIndicator() {
  const { hasActiveRateLimits, rateLimitCount, activeAlerts, isLoading } = useRateLimits();
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);

  // Don't show anything if no rate limits
  if (!hasActiveRateLimits && !isLoading) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
          hasActiveRateLimits
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
        }`}
        title={hasActiveRateLimits ? `${rateLimitCount} Rate Limit Alert(s)` : 'Checking rate limits...'}
      >
        {/* Warning icon */}
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        {hasActiveRateLimits && (
          <>
            <span className="text-xs font-medium hidden sm:inline">{t('rateLimit.title')}</span>
            <span className="flex items-center justify-center min-w-[18px] h-[18px] text-xs font-bold bg-red-500 text-white rounded-full">
              {rateLimitCount}
            </span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && hasActiveRateLimits && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Active Rate Limits
              </h3>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                {rateLimitCount} bot{rateLimitCount !== 1 ? 's' : ''} hitting exchange rate limits
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Auto-clears after 10 minutes of no new occurrences
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {activeAlerts.map((alert) => (
                <Link
                  key={alert.bot_id}
                  to={`/bot/${alert.bot_id}`}
                  onClick={() => setShowDropdown(false)}
                  className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      {alert.bot_name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatAge(alert.age_seconds)}
                    </span>
                  </div>
                  {alert.exchange && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {alert.exchange}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {alert.occurrence_count}x detected
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                    {alert.context}
                  </p>
                </Link>
              ))}
            </div>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Only showing running trading bots
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
