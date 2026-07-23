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

function defaultSections(): Section[] {
  return [
    {
      section_id: 'strategy_validation',
      title: '1. Валидация стратегии',
      score: 0,
      checkboxes: [
        {id: 'sv_bt_period', label: 'Период бэктеста минимум 3 месяца', checked: false},
        {id: 'sv_bt_profit', label: 'Общая доходность бэктеста > 10%', checked: false},
        {id: 'sv_bt_winrate', label: '% прибыльных > 50%', checked: false},
        {id: 'sv_bt_drawdown', label: 'Максимальная просадка < 20%', checked: false},
        {id: 'sv_bt_sharpe', label: 'Коэффициент Шарпа > 1.0', checked: false},
        {id: 'sv_bt_profit_factor', label: 'Фактор прибыли > 1.5', checked: false},
        {id: 'sv_bt_market_types', label: 'Протестированы разные рыночные среды', checked: false},
        {id: 'sv_bt_trades_count', label: 'Количество сделок > 50', checked: false},
        {id: 'sv_dr_period', label: 'Dry-run запущен минимум 7 дней', checked: false},
        {id: 'sv_dr_performance', label: 'Производительность Dry-run соответствует ожиданиям', checked: false},
        {id: 'sv_dr_comparison', label: 'Разница Dry-run vs Backtest в пределах ±50%', checked: false},
        {id: 'sv_logic_clear', label: 'Логика стратегии ясна и теоретически обоснована', checked: false},
        {id: 'sv_logic_code', label: 'Код читаем, нет синтаксических ошибок', checked: false},
        {id: 'sv_no_overfit', label: 'Проверка на переобучение пройдена', checked: false},
      ],
      inputs: [
        {id: 'sv_bt_profit_val', label: 'Доходность бэктеста (%)', value: '', placeholder: 'например 25.5'},
        {id: 'sv_bt_winrate_val', label: '% прибыльных сделок (%)', value: '', placeholder: 'например 62'},
        {id: 'sv_bt_drawdown_val', label: 'Макс. просадка (%)', value: '', placeholder: 'например 12.5'},
        {id: 'sv_dr_profit_val', label: 'Доходность Dry-run (%)', value: '', placeholder: 'например 18.2'},
      ],
    },
    {
      section_id: 'technical_prep',
      title: '2. Техническая подготовка',
      score: 0,
      checkboxes: [
        {id: 'tp_cpu', label: 'Загрузка CPU < 50%', checked: false},
        {id: 'tp_mem', label: 'Использование памяти < 70%', checked: false},
        {id: 'tp_disk', label: 'Свободное место на диске > 10GB', checked: false},
        {id: 'tp_network', label: 'Сетевая задержка < 100ms', checked: false},
        {id: 'tp_api_key', label: 'API ключ настроен, разрешения безопасны', checked: false},
        {id: 'tp_api_withdraw_disabled', label: 'Разрешения на вывод отключены', checked: false},
        {id: 'tp_api_whitelist', label: 'IP белый список включён', checked: false},
        {id: 'tp_api_test', label: 'Тест API подключения успешен', checked: false},
        {id: 'tp_dry_run_false', label: 'dry_run: false в config.live.json', checked: false},
        {id: 'tp_telegram', label: 'Telegram уведомления настроены и протестированы', checked: false},
        {id: 'tp_backup', label: 'Настроено автоматическое резервное копирование', checked: false},
        {id: 'tp_backup_test', label: 'Восстановление из резервной копии протестировано', checked: false},
      ],
      inputs: [
        {id: 'tp_server_uptime', label: 'Время работы сервера (дней)', value: '', placeholder: 'например 30+'},
        {id: 'tp_freqtrade_ver', label: 'Версия Freqtrade', value: '', placeholder: 'например 2024.5'},
        {id: 'tp_api_port', label: 'Порт API Server', value: '8080', placeholder: '8080'},
      ],
    },
    {
      section_id: 'risk_management',
      title: '3. Управление рисками',
      score: 0,
      checkboxes: [
        {id: 'rm_stop_loss', label: 'Стоп-лосс установлен (-2% до -5%)', checked: false},
        {id: 'rm_trailing', label: 'Трейлинг стоп настроен (рекомендуется)', checked: false},
        {id: 'rm_stop_effective', label: 'Эффективность стоп-лосса проверена в Dry-run', checked: false},
        {id: 'rm_stop_alert', label: 'Уведомления о срабатывании стоп-лосса включены', checked: false},
        {id: 'rm_per_trade_risk', label: 'Риск на сделку ≤ 2% от капитала', checked: false},
        {id: 'rm_max_positions', label: 'Лимит макс. позиций разумен (3-5)', checked: false},
        {id: 'rm_stoploss_guard', label: 'StopLossGuard включён', checked: false},
        {id: 'rm_max_drawdown', label: 'Защита MaxDrawdown включена (< 10%)', checked: false},
        {id: 'rm_low_profit', label: 'Защита LowProfitPairs настроена', checked: false},
      ],
      inputs: [
        {id: 'rm_stop_loss_pct', label: 'Стоп-лосс (%)', value: '', placeholder: 'например 3.0'},
        {id: 'rm_trailing_offset', label: 'Триггер трейлинг стопа (%)', value: '', placeholder: 'например 1.0'},
        {id: 'rm_max_daily_loss', label: 'Макс. дневной убыток (%)', value: '', placeholder: 'например 5'},
      ],
    },
    {
      section_id: 'capital_management',
      title: '4. Управление капиталом',
      score: 0,
      checkboxes: [
        {id: 'cm_sufficient', label: 'Начальный капитал минимум 1000 USDT', checked: false},
        {id: 'cm_afford_loss', label: 'Используются средства, доступные для потери', checked: false},
        {id: 'cm_no_borrowed', label: 'Не используются заёмные средства', checked: false},
        {id: 'cm_stake_reasonable', label: 'Ставка на сделку 10-20% от капитала', checked: false},
        {id: 'cm_capital_usage', label: 'Коэффициент использования капитала 50-70%', checked: false},
        {id: 'cm_goals_set', label: 'Установлены краткосрочные и среднесрочные цели', checked: false},
        {id: 'cm_fees_calculated', label: 'Расчёт комиссий выполнен', checked: false},
      ],
      inputs: [
        {id: 'cm_total_capital', label: 'Общий капитал (USDT)', value: '', placeholder: 'например 5000'},
        {id: 'cm_stake_amount', label: 'Сумма на сделку (USDT)', value: '', placeholder: 'например 500'},
        {id: 'cm_max_trades', label: 'Макс. открытых позиций', value: '3', placeholder: '3'},
        {id: 'cm_monthly_target', label: 'Целевая месячная доходность (%)', value: '', placeholder: 'например 5'},
        {id: 'cm_fee_rate', label: 'Комиссия биржи (%)', value: '0.1', placeholder: '0.1'},
      ],
    },
    {
      section_id: 'monitoring',
      title: '5. Механизм мониторинга',
      score: 0,
      checkboxes: [
        {id: 'mn_telegram', label: 'Telegram бот активен и протестирован', checked: false},
        {id: 'mn_entry_notify', label: 'Уведомления о входе включены', checked: false},
        {id: 'mn_exit_notify', label: 'Уведомления о выходе включены', checked: false},
        {id: 'mn_stop_notify', label: 'Уведомления о стоп-лоссе включены', checked: false},
        {id: 'mn_error_notify', label: 'Оповещения об ошибках включены', checked: false},
        {id: 'mn_daily_schedule', label: 'Составлен график ежедневных проверок', checked: false},
        {id: 'mn_weekly_review', label: 'Запланирован еженедельный обзор', checked: false},
        {id: 'mn_alert_thresholds', label: 'Настроены пороги оповещений', checked: false},
      ],
      inputs: [
        {id: 'mn_morning_time', label: 'Время утренней проверки', value: '09:00', placeholder: '09:00'},
        {id: 'mn_evening_time', label: 'Время вечернего отчёта', value: '21:00', placeholder: '21:00'},
      ],
    },
    {
      section_id: 'psychology',
      title: '6. Психологическая подготовка',
      score: 0,
      checkboxes: [
        {id: 'ps_aware_loss', label: 'Понимаю, что будут убытки', checked: false},
        {id: 'ps_ready_drawdown', label: 'Морально готов к просадкам', checked: false},
        {id: 'ps_no_panic', label: 'Не буду паниковать из-за краткосрочных убытков', checked: false},
        {id: 'ps_follow_strategy', label: 'Буду строго следовать стратегии', checked: false},
        {id: 'ps_no_manual', label: 'Обязуюсь не вмешиваться вручную', checked: false},
        {id: 'ps_no_overtrade', label: 'Не буду торговать из мести', checked: false},
        {id: 'ps_emergency_plan', label: 'План экстренных действий готов', checked: false},
        {id: 'ps_stop_process', label: 'Процесс экстренной остановки известен', checked: false},
      ],
      inputs: [
        {id: 'ps_max_loss_tolerate', label: 'Макс. убыток, который могу выдержать (USDT)', value: '', placeholder: 'например 500'},
        {id: 'ps_monitoring_hours', label: 'Часов в день на мониторинг', value: '', placeholder: 'например 2'},
      ],
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
  if (totalScore >= 54) return {label: 'Полностью готов ✅', color: '#22c55e', variant: 'ready'};
  if (totalScore >= 48) return {label: 'В основном готов ⚠️', color: '#eab308', variant: 'caution'};
  if (totalScore >= 42) return {label: 'Недостаточная подготовка ⚠️', color: '#f97316', variant: 'caution'};
  return {label: 'Не готов ❌', color: '#ef4444', variant: 'fail'};
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
        decision: decision.label,
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
            📋 Pre-Launch Checklist
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Интерактивный чек-лист перед реальной торговлей — урок 22 курса Freqtrade
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Сброс
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> Сохранение...</>
            ) : (
              <>💾 Сохранить</>
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
              {decision.label}
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <div>Готовность: {Math.round((totalScore / 60) * 100)}%</div>
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
            ✅ Можно начинать тестирование с малым капиталом. Рекомендуемый начальный капитал: 1000-3000 USDT
          </div>
        )}
        {totalScore >= 48 && totalScore < 54 && (
          <div className="mt-3 text-sm text-yellow-700 dark:text-yellow-300">
            ⚠️ Улучшите слабые места перед запуском. Рекомендуемый капитал: 500-1000 USDT, 1-2 позиции
          </div>
        )}
        {totalScore >= 42 && totalScore < 48 && (
          <div className="mt-3 text-sm text-orange-700 dark:text-orange-300">
            ⚠️ Недостаточная подготовка. Запустите ещё 1 неделю Dry-run. Фокус на разделах с низкими баллами
          </div>
        )}
        {totalScore < 42 && (
          <div className="mt-3 text-sm text-red-700 dark:text-red-300">
            ❌ Не подходит для реальной торговли. Систематически завершите все пункты проверки
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
                    <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {checkedCount}/{totalItems} выполнено
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
                            {cb.label}
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
                            {inp.label}
                          </label>
                          <input
                            type="text"
                            value={inp.value}
                            onChange={e => updateInput(section.section_id, inp.id, e.target.value)}
                            placeholder={inp.placeholder}
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
                      {section.checkboxes.every(c => c.checked) ? 'Снять все' : 'Отметить все'}
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Финальное решение</h3>
          <div className={`text-2xl font-bold`} style={{color: decision.color}}>
            {totalScore} / 60 — {decision.label}
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
                {s.title.replace(/^\d+\.\s*/, '').substring(0, 20)}
              </div>
            </div>
          ))}
        </div>

        {allChecked && (
          <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            ✅ Все пункты отмечены. Вы полностью готовы к запуску реальной торговли.
          </div>
        )}
      </div>
    </div>
  );
}
