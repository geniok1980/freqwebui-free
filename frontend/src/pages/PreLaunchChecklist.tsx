/**
 * Pre-Launch Checklist — интерактивный чек-лист перед реальной торговлей.
 * Основан на уроке 22 курса Freqtrade.
 *
 * 6 секций:
 *   1. Валидация стратегии
 *   2. Техническая подготовка
 *   3. Управление рисками
 *   4. Управление капиталом
 *   5. Механизм мониторинга
 *   6. Психологическая подготовка
 *
 * Каждая секция: чекбоксы + поля ввода + оценка 0-10.
 * Итог: общий балл / 60 → решение Ready / Caution / Fail.
 */

import {useCallback, useEffect, useState} from 'react';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from '../services/api';
import { useTranslation } from 'react-i18next';

// ── Типы ──

interface Checkbox {
  id: string;
  label: string;
  checked: boolean;
}

interface InputField {
  id: string;
  label: string;
  value: string;
  placeholder: string;
}

interface Section {
  section_id: string;
  title: string;
  score: number;
  checkboxes: Checkbox[];
  inputs: InputField[];
}

interface ChecklistData {
  id?: string;
  bot_name?: string;
  sections: Section[];
  total_score: number;
  decision: string | null;
  is_complete: boolean;
}

// ── Default template (из урока 22) ──
// All label/placeholder values are i18n keys resolved with t() at render time.

function defaultSections(): Section[] {
  const ck = (id: string) => `checklist.${id}`;
  const inp = (id: string) => ({ label: ck(id), placeholder: ck(`${id}Placeholder`) });

  return [
    {
      section_id: 'strategy_validation',
      title: ck('strategy_validationTitle'),
      score: 0,
      checkboxes: [
        'sv_bt_period', 'sv_bt_profit', 'sv_bt_winrate', 'sv_bt_drawdown',
        'sv_bt_sharpe', 'sv_bt_profit_factor', 'sv_bt_market_types', 'sv_bt_trades_count',
        'sv_dr_period', 'sv_dr_performance', 'sv_dr_comparison',
        'sv_logic_clear', 'sv_logic_code', 'sv_no_overfit',
      ].map(id => ({ id, label: ck(id), checked: false })),
      inputs: [
        'sv_bt_profit_val', 'sv_bt_winrate_val', 'sv_bt_drawdown_val', 'sv_dr_profit_val',
      ].map(id => ({ id, ...inp(id), value: '' })),
    },
    {
      section_id: 'technical_prep',
      title: ck('technical_prepTitle'),
      score: 0,
      checkboxes: [
        'tp_cpu', 'tp_mem', 'tp_disk', 'tp_network',
        'tp_api_key', 'tp_api_withdraw_disabled', 'tp_api_whitelist', 'tp_api_test',
        'tp_dry_run_false', 'tp_telegram', 'tp_backup', 'tp_backup_test',
      ].map(id => ({ id, label: ck(id), checked: false })),
      inputs: [
        { id: 'tp_server_uptime', ...inp('tp_server_uptime'), value: '' },
        { id: 'tp_freqtrade_ver', ...inp('tp_freqtrade_ver'), value: '' },
        { id: 'tp_api_port', ...inp('tp_api_port'), value: '8080' },
      ],
    },
    {
      section_id: 'risk_management',
      title: ck('risk_managementTitle'),
      score: 0,
      checkboxes: [
        'rm_stop_loss', 'rm_trailing', 'rm_stop_effective', 'rm_stop_alert',
        'rm_per_trade_risk', 'rm_max_positions',
        'rm_stoploss_guard', 'rm_max_drawdown', 'rm_low_profit',
      ].map(id => ({ id, label: ck(id), checked: false })),
      inputs: [
        'rm_stop_loss_pct', 'rm_trailing_offset', 'rm_max_daily_loss',
      ].map(id => ({ id, ...inp(id), value: '' })),
    },
    {
      section_id: 'capital_management',
      title: ck('capital_managementTitle'),
      score: 0,
      checkboxes: [
        'cm_sufficient', 'cm_afford_loss', 'cm_no_borrowed', 'cm_stake_reasonable',
        'cm_capital_usage', 'cm_goals_set', 'cm_fees_calculated',
      ].map(id => ({ id, label: ck(id), checked: false })),
      inputs: [
        { id: 'cm_total_capital', ...inp('cm_total_capital'), value: '' },
        { id: 'cm_stake_amount', ...inp('cm_stake_amount'), value: '' },
        { id: 'cm_max_trades', ...inp('cm_max_trades'), value: '3' },
        { id: 'cm_monthly_target', ...inp('cm_monthly_target'), value: '' },
        { id: 'cm_fee_rate', ...inp('cm_fee_rate'), value: '0.1' },
      ],
    },
    {
      section_id: 'monitoring',
      title: ck('monitoringTitle'),
      score: 0,
      checkboxes: [
        'mn_telegram', 'mn_entry_notify', 'mn_exit_notify', 'mn_stop_notify',
        'mn_error_notify', 'mn_daily_schedule', 'mn_weekly_review', 'mn_alert_thresholds',
      ].map(id => ({ id, label: ck(id), checked: false })),
      inputs: [
        { id: 'mn_morning_time', ...inp('mn_morning_time'), value: '09:00' },
        { id: 'mn_evening_time', ...inp('mn_evening_time'), value: '21:00' },
      ],
    },
    {
      section_id: 'psychology',
      title: ck('psychologyTitle'),
      score: 0,
      checkboxes: [
        'ps_aware_loss', 'ps_ready_drawdown', 'ps_no_panic', 'ps_follow_strategy',
        'ps_no_manual', 'ps_no_overtrade', 'ps_emergency_plan', 'ps_stop_process',
      ].map(id => ({ id, label: ck(id), checked: false })),
      inputs: [
        'ps_max_loss_tolerate', 'ps_monitoring_hours',
      ].map(id => ({ id, ...inp(id), value: '' })),
    },
  ];
}

// ── Scoring logic (из урока 22) ──

function computeSectionScore(section: Section): number {
  const checked = section.checkboxes.filter(c => c.checked).length;
  const total = section.checkboxes.length;
  if (total === 0) return 0;
  const pct = checked / total;
  if (pct >= 0.9) return 10;
  if (pct >= 0.8) return 8;
  if (pct >= 0.7) return 6;
  if (pct >= 0.6) return 4;
  if (pct >= 0.4) return 2;
  return 0;
}

function computeDecision(totalScore: number): {label: string; color: string; variant: 'ready' | 'caution' | 'fail'} {
  if (totalScore >= 54) return {label: 'checklist.decision_ready', color: '#22c55e', variant: 'ready'};
  if (totalScore >= 48) return {label: 'checklist.decision_mostlyReady', color: '#eab308', variant: 'caution'};
  if (totalScore >= 42) return {label: 'checklist.decision_insufficientPrep', color: '#f97316', variant: 'caution'};
  return {label: 'checklist.decision_notReady', color: '#ef4444', variant: 'fail'};
}

// ── API helpers ──

async function fetchChecklist(): Promise<ChecklistData | null> {
  const res = await api.get<ChecklistData[]>('/checklists');
  const list = res?.data;
  if (list && list.length > 0) return list[0];
  return null;
}

async function saveChecklist(data: ChecklistData): Promise<ChecklistData> {
  if (data.id) {
    const res = await api.put<ChecklistData>(`/checklists/${data.id}`, {
      bot_name: data.bot_name,
      sections: data.sections,
      total_score: data.total_score,
      decision: data.decision,
      is_complete: data.is_complete,
    });
    return res.data;
  } else {
    const res = await api.post<ChecklistData>('/checklists', {
      bot_name: data.bot_name,
      sections: data.sections,
      total_score: data.total_score,
      decision: data.decision,
      is_complete: data.is_complete,
    });
    return res.data;
  }
}

// ── Component ──

export function PreLaunchChecklist() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [sections, setSections] = useState<Section[]>(defaultSections);
  const [checklistId, setChecklistId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string>('strategy_validation');

  // Load from API
  const {data: loaded, isLoading} = useQuery({
    queryKey: ['checklist'],
    queryFn: fetchChecklist,
  });

  useEffect(() => {
    if (loaded) {
      setChecklistId(loaded.id ?? null);
      setSections(loaded.sections);
    }
  }, [loaded]);

  // Computed
  const scoredSections = sections.map(s => ({...s, score: computeSectionScore(s)}));
  const totalScore = scoredSections.reduce((sum, s) => sum + s.score, 0);
  const decision = computeDecision(totalScore);

  // Handlers
  const toggleCheckbox = useCallback((sectionId: string, checkboxId: string) => {
    setSections(prev =>
      prev.map(s => {
        if (s.section_id !== sectionId) return s;
        return {
          ...s,
          checkboxes: s.checkboxes.map(c =>
            c.id === checkboxId ? {...c, checked: !c.checked} : c,
          ),
        };
      }),
    );
  }, []);

  const updateInput = useCallback((sectionId: string, inputId: string, value: string) => {
    setSections(prev =>
      prev.map(s => {
        if (s.section_id !== sectionId) return s;
        return {
          ...s,
          inputs: s.inputs.map(i => (i.id === inputId ? {...i, value} : i)),
        };
      }),
    );
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ChecklistData = {
        id: checklistId ?? undefined,
        sections: scoredSections,
        total_score: totalScore,
        decision: t(decision.label),
        is_complete: decision.variant === 'ready',
      };
      const result = await saveChecklist(payload);
      if (!checklistId && result?.id) {
        setChecklistId(result.id);
      }
      queryClient.invalidateQueries({queryKey: ['checklist']});
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSections(defaultSections());
    setChecklistId(null);
  };

  const allChecked = sections.every(s => s.checkboxes.every(c => c.checked));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('checklist.pageTitle')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('checklist.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {t('checklist.reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> {t('checklist.saving')}</>
            ) : (
              <>{t('checklist.save')}</>
            )}
          </button>
        </div>
      </div>

      {/* Score Card */}
      <div className={`rounded-xl p-6 border transition-colors ${
        decision.variant === 'ready' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
        decision.variant === 'caution' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
        'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold" style={{color: decision.color}}>
              {totalScore} / 60
            </div>
            <div className="text-lg font-semibold mt-1" style={{color: decision.color}}>
              {t(decision.label)}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <div>{t('checklist.readiness')}: {Math.round((totalScore / 60) * 100)}%</div>
            <div className="mt-1 w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(totalScore / 60) * 100}%`,
                  backgroundColor: decision.color,
                }}
              />
            </div>
          </div>
        </div>
        {totalScore >= 54 && (
          <div className="mt-3 text-sm text-green-700 dark:text-green-300">
            {t('checklist.readyMessage')}
          </div>
        )}
        {totalScore >= 48 && totalScore < 54 && (
          <div className="mt-3 text-sm text-yellow-700 dark:text-yellow-300">
            {t('checklist.mostlyReadyMessage')}
          </div>
        )}
        {totalScore >= 42 && totalScore < 48 && (
          <div className="mt-3 text-sm text-orange-700 dark:text-orange-300">
            {t('checklist.insufficientPrepMessage')}
          </div>
        )}
        {totalScore < 42 && (
          <div className="mt-3 text-sm text-red-700 dark:text-red-300">
            {t('checklist.notReadyMessage')}
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {scoredSections.map(section => {
          const isOpen = expanded === section.section_id;
          const checkedCount = section.checkboxes.filter(c => c.checked).length;
          const totalItems = section.checkboxes.length;

          return (
            <div
              key={section.section_id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden transition-all"
            >
              {/* Section header */}
              <button
                onClick={() => setExpanded(isOpen ? '' : section.section_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white`}
                    style={{
                      backgroundColor:
                        section.score >= 8 ? '#22c55e' :
                        section.score >= 6 ? '#eab308' :
                        section.score >= 4 ? '#f97316' :
                        '#ef4444',
                    }}
                  >
                    {section.score}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{t(section.title)}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('checklist.checkedCount', { checked: checkedCount, total: totalItems })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(checkedCount / totalItems) * 100}%`,
                        backgroundColor:
                          section.score >= 8 ? '#22c55e' :
                          section.score >= 6 ? '#eab308' :
                          section.score >= 4 ? '#f97316' :
                          '#ef4444',
                      }}
                    />
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Section content */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 dark:border-gray-700">
                  {/* Checkboxes */}
                  {section.checkboxes.length > 0 && (
                    <div className="pt-4 space-y-1.5">
                      {section.checkboxes.map(cb => (
                        <label
                          key={cb.id}
                          className="flex items-start gap-3 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={cb.checked}
                            onChange={() => toggleCheckbox(section.section_id, cb.id)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={`text-sm ${cb.checked ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                            {t(cb.label)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Inputs */}
                  {section.inputs.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {section.inputs.map(inp => (
                        <div key={inp.id}>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            {t(inp.label)}
                          </label>
                          <input
                            type="text"
                            value={inp.value}
                            onChange={e => updateInput(section.section_id, inp.id, e.target.value)}
                            placeholder={t(inp.placeholder)}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Check all in section */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const allDone = section.checkboxes.every(c => c.checked);
                        setSections(prev =>
                          prev.map(s => {
                            if (s.section_id !== section.section_id) return s;
                            return {
                              ...s,
                              checkboxes: s.checkboxes.map(c => ({...c, checked: !allDone})),
                            };
                          }),
                        );
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {section.checkboxes.every(c => c.checked)
                        ? t('checklist.uncheckAll')
                        : t('checklist.checkAll')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('checklist.finalDecision')}</h3>
          <div className={`text-2xl font-bold`} style={{color: decision.color}}>
            {totalScore} / 60 — {t(decision.label)}
          </div>
        </div>

        {/* Per-section breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {scoredSections.map(s => (
            <div key={s.section_id} className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-750">
              <div className="text-lg font-bold" style={{
                color: s.score >= 8 ? '#22c55e' : s.score >= 6 ? '#eab308' : s.score >= 4 ? '#f97316' : '#ef4444',
              }}>
                {s.score}/10
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                {t(s.title).replace(/^\d+\.\s*/, '').substring(0, 20)}
              </div>
            </div>
          ))}
        </div>

        {allChecked && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            {t('checklist.allCheckedMessage')}
          </div>
        )}
      </div>
    </div>
  );
}
