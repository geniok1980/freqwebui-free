/**
 * Strategy Creator Page — AI-generated strategy builder
 * POST /strategy-lab/ai/generate → preview → save/backtest
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const API_BASE = (import.meta.env.VITE_API_URL as string) || '/api/v1';

interface GenerateResponse {
  status: string;
  data?: {
    strategy_name: string;
    class_name: string;
    family: string;
    path: string;
    preview: string;
  };
  detail?: string;
}

export function StrategyCreator() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResponse['data'] | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError(t('strategyLab.noDescription'));
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE}/strategy-lab/ai/generate`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description.trim(),
          name: name.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setError(
          '⚠️ Стратегия с таким именем уже существует. ' +
            (body.detail || 'Выберите другое имя или используйте автоматическую генерацию.')
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        setError(`${t('strategyLab.generationError')}: ${body.detail || res.statusText}`);
        setLoading(false);
        return;
      }

      const data: GenerateResponse = await res.json();
      if (data.status === 'success' && data.data) {
        setResult(data.data);
      } else {
        setError(`${t('strategyLab.generationError')}: ${data.detail || 'Неизвестный формат ответа'}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network error';
      setError(`${t('strategyLab.generationError')}: ${msg}`);
    }

    setLoading(false);
  };

  const handleBacktest = async () => {
    try {
      const token = localStorage.getItem('access_token');
      // Start a workflow with just the backtest step
      await fetch(`${API_BASE}/strategy-lab/workflow/start`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          strategy: result?.strategy_name,
          steps: ['backtest'],
          epochs: 30,
          auto_promote: false,
          max_drawdown_threshold: 2.0,
        }),
      });
    } catch {
      // Silently continue — navigate regardless
    }
    navigate('/backtest');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            🧠 {t('strategyLab.createStrategy')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('strategyLab.createStrategyDesc')}
          </p>
        </div>
        <Link
          to="/strategy-lab"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← {t('strategyLab.backToStrategyLab')}
        </Link>
      </div>

      {/* Input Card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="space-y-4">
          {/* Strategy name (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('strategyLab.strategyName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('strategyLab.strategyName')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-400 mt-1">{t('strategyLab.nameAuto')}</p>
          </div>

          {/* Description (required) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Опишите идею <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('strategyLab.ideaPlaceholder')}
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y min-h-[120px]"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
            className="w-full px-6 py-3 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t('strategyLab.generating')}
              </span>
            ) : (
              t('strategyLab.generateBtn')
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Strategy name */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              ✅ {t('strategyLab.savedStrategy')}
            </h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {result.strategy_name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              class: {result.class_name} · family: {result.family}
            </p>
          </div>

          {/* Code preview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-gray-700 dark:text-gray-300">
                {t('strategyLab.preview')}
              </h3>
              <span className="text-xs text-gray-400">{result.path}</span>
            </div>
            <pre className="bg-[#0d1117] dark:bg-[#0d1117] text-gray-200 p-4 overflow-auto max-h-96 text-sm font-mono whitespace-pre">
              <code>{result.preview}</code>
            </pre>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleBacktest}
              className="flex-1 px-6 py-3 rounded-lg font-medium text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              📊 Запустить бектест
            </button>
            <Link
              to="/strategy-lab/strategies"
              className="flex-1 px-6 py-3 rounded-lg font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 transition-colors"
            >
              📋 К списку стратегий
            </Link>
          </div>

          <p className="text-sm text-gray-400 text-center">
            {t('strategyLab.createdStrategyHint')}
          </p>
        </div>
      )}
    </div>
  );
}
