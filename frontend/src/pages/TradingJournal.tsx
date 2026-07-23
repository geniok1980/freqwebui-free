/**
 * Trading Journal — ежедневный/недельный журнал торговли (урок 24).
 *
 * Возможности:
 * - Список записей с фильтрацией по дате/типу/боту
 * - Создание записи с авто-шаблоном (метрики подставляются)
 * - Редактор в Markdown
 * - Оценка качества сигналов (урок 16)
 * - Пины, теги, удаление
 */

import {useState, useCallback, useEffect} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from '../services/api';
import { useTranslation } from 'react-i18next';

// ── Types ──

interface JournalEntry {
  id: string;
  bot_id: string | null;
  entry_date: string;
  entry_type: string;
  title: string;
  content_md: string;
  metrics: Record<string, any> | null;
  signals: any[] | null;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface BotOption {
  id: string;
  name: string;
}

// ── API ──

async function fetchEntries(params?: {
  limit?: number; offset?: number; entry_type?: string; bot_id?: string;
}): Promise<{data: JournalEntry[]; total: number}> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  if (params?.entry_type) q.set('entry_type', params.entry_type);
  if (params?.bot_id) q.set('bot_id', params.bot_id);
  const res = await api.get<JournalEntry[]>(`/journal?${q.toString()}`);
  // The API returns {status, data, total, limit, offset}
  return {data: (res as any)?.data ?? [], total: (res as any)?.total ?? 0};
}

async function generateTemplate(botId?: string): Promise<{
  title: string; entry_date: string; entry_type: string; content_md: string; metrics: any;
}> {
  const res = await api.post('/journal/template', {bot_id: botId || null});
  return (res as any)?.data;
}

async function saveEntry(body: Partial<JournalEntry> & {content_md: string; title: string}): Promise<JournalEntry> {
  if ((body as any).id) {
    const res = await api.put(`/journal/${(body as any).id}`, body);
    return (res as any)?.data;
  }
  const res = await api.post('/journal', body);
  return (res as any)?.data;
}

async function deleteEntry(id: string): Promise<void> {
  await api.delete(`/journal/${id}`);
}

// ── Entry card (compact) ──

function EntryCard({entry, active, onClick, onDelete}: {
  entry: JournalEntry; active: boolean; onClick: () => void; onDelete: () => void;
}) {
  const dateStr = new Date(entry.entry_date).toLocaleDateString('ru-RU');
  const typeLabels: Record<string, string> = {daily: '📅', weekly: '📆', monthly: '📊'};
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer border transition-all ${
        active
          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-750'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span>{typeLabels[entry.entry_type] || '📝'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{dateStr}</span>
          {entry.is_pinned && <span className="text-xs">📌</span>}
        </div>
        <button
          onClick={e => {e.stopPropagation(); onDelete();}}
          className="text-gray-300 hover:text-red-400 text-xs shrink-0"
          title="Удалить"
        >✕</button>
      </div>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate mt-0.5">{entry.title}</p>
      {entry.tags.length > 0 && (
        <div className="flex gap-1 mt-1 flex-wrap">
          {entry.tags.map(t => (
            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Signal scorer widget ──

function SignalScorer({onScore}: {onScore?: (result: any) => void}) {
  const [profit, setProfit] = useState('1.2');
  const [hours, setHours] = useState('4');
  const [reason, setReason] = useState('roi');
  const [result, setResult] = useState<any>(null);
  const [scoring, setScoring] = useState(false);

  const handleScore = async () => {
    setScoring(true);
    try {
      const res = await api.post('/journal/score-signal', {
        profit_pct: parseFloat(profit) || 0,
        duration_hours: parseFloat(hours) || 0,
        exit_reason: reason,
      });
      const r = (res as any)?.data;
      setResult(r);
      onScore?.(r);
    } finally {
      setScoring(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        🎯 Оценка качества сигнала
      </h4>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Прибыль %</label>
            <input
              type="number" step="0.1" value={profit}
              onChange={e => setProfit(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Часов</label>
            <input
              type="number" step="0.5" value={hours}
              onChange={e => setHours(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-0.5">Причина</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="roi">ROI</option>
              <option value="exit_signal">Сигнал</option>
              <option value="trailing_stop">Trailing</option>
              <option value="stop_loss">Стоп-лосс</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleScore}
          disabled={scoring}
          className="w-full py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {scoring ? '...' : 'Оценить'}
        </button>
        {result && (
          <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
            <div className="text-lg">{result.rating}</div>
            <div className="text-xs text-gray-500">{result.label} ({result.score}/100)</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Entry editor ──

function EntryEditor({entry, onSave, onClose}: {
  entry: Partial<JournalEntry> | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content_md || '');
  const [entryType, setEntryType] = useState(entry?.entry_type || 'daily');
  const [entryDate, setEntryDate] = useState(entry?.entry_date || new Date().toISOString().slice(0, 10));
  const [tagsStr, setTagsStr] = useState((entry?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        id: (entry as any)?.id,
        title: title || 'Без названия',
        content_md: content,
        entry_type: entryType,
        entry_date: entryDate,
        tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
        bot_id: (entry as any)?.bot_id,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Заголовок записи"
          className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <select
          value={entryType}
          onChange={e => setEntryType(e.target.value)}
          className="px-2 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        >
          <option value="daily">📅 День</option>
          <option value="weekly">📆 Неделя</option>
          <option value="monthly">📊 Месяц</option>
        </select>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <input
          type="date"
          value={entryDate}
          onChange={e => setEntryDate(e.target.value)}
          className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        />
        <span>Теги:</span>
        <input
          type="text"
          value={tagsStr}
          onChange={e => setTagsStr(e.target.value)}
          placeholder="тег1, тег2"
          className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
        />
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Напишите отчёт в Markdown..."
        className="w-full h-80 px-3 py-2 text-sm font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y"
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100"
        >
          Отмена
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : '💾 Сохранить'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ──

export function TradingJournal() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<JournalEntry> | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [bots, setBots] = useState<BotOption[]>([]);

  // Load bots for template
  useEffect(() => {
    api.get<any[]>('/bots').then(res => {
      const list = (res as any)?.data ?? [];
      setBots(list.map((b: any) => ({id: b.id, name: b.name})));
    }).catch(() => {});
  }, []);

  const {data, isLoading} = useQuery({
    queryKey: ['journal', filterType],
    queryFn: () => fetchEntries({limit: 100, entry_type: filterType || undefined}),
  });

  const entries = data?.data ?? [];
  const selected = entries.find(e => e.id === selectedId) || null;

  // Create new entry with template
  const [templateError, setTemplateError] = useState<string | null>(null);

  const handleNewEntry = async () => {
    setTemplateError(null);
    try {
      const tmpl = await generateTemplate();
      setEditingEntry({
        title: tmpl.title,
        content_md: tmpl.content_md,
        entry_date: tmpl.entry_date,
        entry_type: 'daily',
        metrics: tmpl.metrics,
        tags: [],
      });
      setSelectedId(null);
      setShowEditor(true);
    } catch (err) {
      setTemplateError((err as Error).message || 'Ошибка при создании шаблона');
    }
  };

  // Edit existing
  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry({...entry, tags: [...(entry.tags || [])]});
    setShowEditor(true);
  };

  // Save
  const handleSave = async (data: any) => {
    await saveEntry(data);
    qc.invalidateQueries({queryKey: ['journal']});
    setShowEditor(false);
    setEditingEntry(null);
  };

  // Delete
  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    qc.invalidateQueries({queryKey: ['journal']});
    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            📓 Журнал торговли
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Журнал с авто-шаблонами и оценкой сигналов — уроки 16, 24
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="">Все типы</option>
            <option value="daily">📅 Дневные</option>
            <option value="weekly">📆 Недельные</option>
            <option value="monthly">📊 Месячные</option>
          </select>
          <button
            onClick={handleNewEntry}
            className="px-3 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
          >
            ✚ Новая запись
          </button>
        </div>
      </div>

      {templateError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 mb-4 text-sm text-red-600 dark:text-red-400">
          {templateError}
        </div>
      )}

      <div className="flex gap-4">
        {/* Left: Entry list */}
        <div className="w-72 shrink-0 space-y-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-gray-400">Загрузка...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              <p>Записей пока нет</p>
              <p className="text-xs mt-1">Создайте первую запись с авто-шаблоном</p>
            </div>
          ) : (
            entries.map(e => (
              <EntryCard
                key={e.id}
                entry={e}
                active={selectedId === e.id}
                onClick={() => {
                  setSelectedId(e.id);
                  setShowEditor(false);
                }}
                onDelete={() => handleDelete(e.id)}
              />
            ))
          )}

          {/* Signal scorer sidebar */}
          <div className="mt-4">
            <SignalScorer />
          </div>
        </div>

        {/* Right: Detail / Editor */}
        <div className="flex-1 min-w-0">
          {showEditor && editingEntry ? (
            <EntryEditor
              entry={editingEntry}
              onSave={handleSave}
              onClose={() => {setShowEditor(false); setEditingEntry(null);}}
            />
          ) : selected ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selected.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    <span>📅 {new Date(selected.entry_date).toLocaleDateString('ru-RU')}</span>
                    <span>{selected.entry_type === 'daily' ? '📅' : selected.entry_type === 'weekly' ? '📆' : '📊'}</span>
                    {selected.is_pinned && <span>📌</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(selected)}
                    className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 hover:bg-gray-100"
                  >
                    ✏️
                  </button>
                </div>
              </div>

              {/* Metrics snapshot */}
              {selected.metrics && (
                <div className="grid grid-cols-5 gap-2 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-750">
                  {Object.entries(selected.metrics).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {typeof v === 'number' ? (k.includes('pct') || k.includes('rate') ? v + '%' : v) : String(v ?? '—')}
                      </div>
                      <div className="text-[10px] text-gray-500">{k.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Content (rendered as plain markdown preview) */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {selected.content_md || '(пусто)'}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-10 text-center text-gray-400">
              <div className="text-4xl mb-3">📓</div>
              <p className="text-sm">Выберите запись слева или создайте новую</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
