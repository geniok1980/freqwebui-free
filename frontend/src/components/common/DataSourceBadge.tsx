/**
 * DataSourceBadge - Indicates whether data is from API or SQLite database.
 *
 * Shows the current data source mode with appropriate visual indicators.
 */
import type { SourceMode } from '../../types';

interface DataSourceBadgeProps {
  source: SourceMode;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const sourceConfig: Record<SourceMode, {
  label: string;
  shortLabel: string;
  icon: string;
  bgClass: string;
  textClass: string;
  tooltip: string;
}> = {
  api: {
    label: 'Live API',
    shortLabel: 'API',
    icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-400',
    tooltip: 'Данные в реальном времени из Freqtrade API',
  },
  sqlite: {
    label: 'База данных',
    shortLabel: 'DB',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-400',
    tooltip: 'Исторические данные из SQLite',
  },
  mixed: {
    label: 'Смешанные источники',
    shortLabel: 'Смеш.',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-400',
    tooltip: 'Комбинация данных API и базы',
  },
  auto: {
    label: 'Автовыбор',
    shortLabel: 'Авто',
    icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30',
    textClass: 'text-purple-700 dark:text-purple-400',
    tooltip: 'Автоматический выбор лучшего источника данных',
  },
};

const sizeClasses = {
  sm: {
    badge: 'px-1.5 py-0.5 text-xs',
    icon: 'w-3 h-3',
  },
  md: {
    badge: 'px-2 py-1 text-sm',
    icon: 'w-4 h-4',
  },
  lg: {
    badge: 'px-2.5 py-1.5 text-base',
    icon: 'w-5 h-5',
  },
};

export function DataSourceBadge({
  source,
  size = 'sm',
  showTooltip = true,
}: DataSourceBadgeProps) {
  const config = sourceConfig[source];
  const sizeClass = sizeClasses[size];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${sizeClass.badge} ${config.bgClass} ${config.textClass}`}
      title={showTooltip ? config.tooltip : undefined}
    >
      <svg
        className={sizeClass.icon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={config.icon}
        />
      </svg>
      <span>{size === 'sm' ? config.shortLabel : config.label}</span>
    </span>
  );
}

interface DataSourceIndicatorProps {
  source: SourceMode;
  showLabel?: boolean;
}

export function DataSourceIndicator({
  source,
  showLabel = false,
}: DataSourceIndicatorProps) {
  const config = sourceConfig[source];

  return (
    <div className="flex items-center gap-1.5" title={config.tooltip}>
      <svg
        className={`w-4 h-4 ${config.textClass}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={config.icon}
        />
      </svg>
      {showLabel && (
        <span className={`text-xs font-medium ${config.textClass}`}>
          {config.shortLabel}
        </span>
      )}
    </div>
  );
}
