/**
 * Agent Dashboard - Multibotdashboard V8
 * Full-featured AI Trading Agent interface
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Play,
  Pause,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Brain,
  Target,
  Zap,
  Globe,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Shield,
  Server,
  Layers,
  Container
} from 'lucide-react';
import { api } from '../../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';

// Types
interface Trade {
  id: number;
  timestamp: string;
  pair: string;
  direction: string;
  confidence: number;
  stake_amount: number;
  entry_price: number;
  status: string;
  final_profit: number;
  signals?: Record<string, number>;
}

interface AgentStatus {
  enabled: boolean;
  container_running: boolean;
  paper_trading: boolean;
  today_trades: number;
  today_signals: number;
  today_wins: number;
  today_win_rate: number;
  current_regime: string;
}

interface SignalWeights {
  regime: string;
  price_momentum_weight: number;
  volume_weight: number;
  sentiment_weight: number;
  macro_weight: number;
  orderbook_weight: number;
  total_weight: number;
  win_rate: number;
  total_trades: number;
  last_updated: string;
}

interface PerformanceDay {
  date: string;
  total_signals: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_profit: number;
  total_profit: number;
}

interface RegimePerformance {
  regime: string;
  total_trades: number;
  wins: number;
  win_rate: number;
  avg_profit: number;
}

interface CurrentRegime {
  regime: string;
  timestamp: string;
  btc_price: number;
  btc_sma50: number;
  btc_sma200: number;
  atr_14: number;
}

type TabId = 'overview' | 'trades' | 'weights' | 'performance';

const REGIME_COLORS: Record<string, string> = {
  'trending_up': '#238636',
  'trending_down': '#f85149',
  'ranging': '#f0883e',
  'volatile': '#a371f7',
  'breakout': '#58a6ff'
};

export function AgentDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedTrade, setExpandedTrade] = useState<number | null>(null);

  // Fetch agent status
  const { data: status } = useQuery<AgentStatus>({
    queryKey: ['agent', 'status'],
    queryFn: async () => {
      const result = await api.get<AgentStatus>('/agent/status');
      return result.data as AgentStatus;
    },
    refetchInterval: 10000
  });

  // Fetch trades
  const { data: trades, isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ['agent', 'trades'],
    queryFn: async () => {
      const result = await api.get<Trade[]>('/agent/trades?limit=50');
      return Array.isArray(result.data) ? result.data : [];
    },
    refetchInterval: 30000
  });

  // Fetch signal weights
  const { data: weights, isLoading: weightsLoading } = useQuery<SignalWeights[]>({
    queryKey: ['agent', 'weights'],
    queryFn: async () => {
      const result = await api.get<SignalWeights[]>('/agent/weights');
      return Array.isArray(result.data) ? result.data : [];
    }
  });

  // Fetch performance
  const { data: performance, isLoading: performanceLoading } = useQuery<PerformanceDay[]>({
    queryKey: ['agent', 'performance'],
    queryFn: async () => {
      const result = await api.get<PerformanceDay[]>('/agent/performance?days=30');
      return Array.isArray(result.data) ? result.data : [];
    }
  });

  // Fetch regime performance
  const { data: regimePerformance, isLoading: regimePerfLoading } = useQuery<RegimePerformance[]>({
    queryKey: ['agent', 'regime-performance'],
    queryFn: async () => {
      const result = await api.get<RegimePerformance[]>('/agent/performance/by-regime');
      return Array.isArray(result.data) ? result.data : [];
    }
  });

  // Fetch current regime
  const { data: currentRegime } = useQuery<CurrentRegime>({
    queryKey: ['agent', 'regime', 'current'],
    queryFn: async () => {
      const result = await api.get<CurrentRegime>('/agent/regime/current');
      return result.data as CurrentRegime;
    },
    refetchInterval: 60000
  });

  // Toggle agent mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const endpoint = status?.enabled ? '/agent/disable' : '/agent/enable';
      return await api.post(endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'status'] });
    }
  });

  // Run Docker Agent mutation
  const runDockerMutation = useMutation({
    mutationFn: async () => {
      return await api.post('/agent/docker/run');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', 'status'] });
    }
  });

  // Calculate totals
  const totalProfit = trades?.reduce((sum, t) => sum + (t.final_profit || 0), 0) || 0;
  const winCount = trades?.filter(t => (t.final_profit || 0) > 0).length || 0;
  const totalClosed = trades?.filter(t => t.status === 'closed').length || 0;
  const overallWinRate = totalClosed > 0 ? (winCount / totalClosed * 100) : 0;

  const tabs = [
    { id: 'overview', label: 'Обзор', icon: Activity },
    { id: 'trades', label: 'Сделки', icon: BarChart3 },
    { id: 'weights', label: 'Веса сигналов', icon: Brain },
    { id: 'performance', label: 'Производительность', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#e6edf3]">AI торговый агент</h1>
          <p className="text-[#8b949e] mt-1">
            Динамическая стратегия весов с адаптацией сигналов по рыночному режиму
          </p>
        </div>
        <div className="flex items-center gap-3">
          {status?.paper_trading && (
            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm rounded-full flex items-center gap-1">
              <Shield size={14} />
              Бумажная торговля
            </span>
          )}
          <button
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              status?.enabled
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/50'
            }`}
          >
            {toggleMutation.isPending ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : status?.enabled ? (
              <><Pause size={18} /> Пауза агента</>
            ) : (
              <><Play size={18} /> Запустить агента</>
            )}
          </button>
          
          {/* Run Docker Agent Button */}
          <button
            onClick={() => runDockerMutation.mutate()}
            disabled={runDockerMutation.isPending}
            className="px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/50"
          >
            {runDockerMutation.isPending ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <><Container size={18} /> Запустить Docker-агент</>
            )}
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#8b949e]">
              <Server size={18} />
              <span className="text-sm">Статус агента</span>
            </div>
            <div className={`w-2 h-2 rounded-full ${status?.enabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          </div>
          <div className="mt-2">
            <span className={`text-lg font-semibold ${status?.enabled ? 'text-green-400' : 'text-red-400'}`}>
              {status?.enabled ? 'Активен' : 'На паузе'}
            </span>
            {status?.container_running && (
              <span className="ml-2 text-xs text-[#8b949e]">(Контейнер запущен)</span>
            )}
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#8b949e]">
            <Target size={18} />
            <span className="text-sm">Винрейт за сегодня</span>
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-bold ${(status?.today_win_rate || 0) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {status?.today_win_rate?.toFixed(1) || 0}%
            </span>
            <span className="text-sm text-[#8b949e] ml-2">
              ({status?.today_wins || 0}/{status?.today_signals || 0} сигналов)
            </span>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#8b949e]">
            <Zap size={18} />
            <span className="text-sm">Сделок сегодня</span>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-[#e6edf3]">
              {status?.today_trades || 0}
            </span>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4">
          <div className="flex items-center gap-2 text-[#8b949e]">
            <Globe size={18} />
            <span className="text-sm">Рыночный режим</span>
          </div>
          <div className="mt-2">
            <span
              className="text-lg font-semibold px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${REGIME_COLORS[status?.current_regime || 'ranging']}20`,
                color: REGIME_COLORS[status?.current_regime || 'ranging']
              }}
            >
              {status?.current_regime || 'Неизвестно'}
            </span>
            {currentRegime?.btc_price && (
              <span className="text-sm text-[#8b949e] ml-2">
                BTC ${currentRegime.btc_price.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <BarChart3 className="text-blue-400" size={24} />
          </div>
          <div>
            <p className="text-[#8b949e] text-sm">Всего сделок</p>
            <p className="text-2xl font-bold text-[#e6edf3]">{trades?.length || 0}</p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
            <TrendingUp className="text-green-400" size={24} />
          </div>
          <div>
            <p className="text-[#8b949e] text-sm">Общий винрейт</p>
            <p className={`text-2xl font-bold ${overallWinRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
              {overallWinRate.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Layers className="text-purple-400" size={24} />
          </div>
          <div>
            <p className="text-[#8b949e] text-sm">Итоговый P&L</p>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg">
        <div className="border-b border-[#30363d]">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#58a6ff] text-[#58a6ff]'
                      : 'border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:border-[#30363d]'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Regime Performance */}
              <div>
                <h3 className="text-lg font-semibold text-[#e6edf3] mb-4">Производительность по рыночным режимам</h3>
                {regimePerfLoading ? (
                  <div className="text-center py-8 text-[#8b949e]">Загрузка...</div>
                ) : regimePerformance && regimePerformance.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {regimePerformance.map((regime) => (
                      <div key={regime.regime} className="bg-[#0f1419] rounded-lg p-4 border border-[#30363d]">
                        <div className="flex items-center justify-between mb-3">
                          <span
                            className="px-2 py-1 rounded text-sm font-medium"
                            style={{
                              backgroundColor: `${REGIME_COLORS[regime.regime] || '#8b949e'}20`,
                              color: REGIME_COLORS[regime.regime] || '#8b949e'
                            }}
                          >
                            {regime.regime}
                          </span>
                          <span className="text-[#8b949e] text-sm">{regime.total_trades} сделок</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-[#8b949e] text-sm">Винрейт</span>
                            <span className={regime.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}>
                              {regime.win_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8b949e] text-sm">Победы</span>
                            <span className="text-green-400">{regime.wins}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8b949e] text-sm">Средняя прибыль</span>
                            <span className={regime.avg_profit >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {regime.avg_profit >= 0 ? '+' : ''}{regime.avg_profit.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#8b949e]">
                    <AlertTriangle size={48} className="mx-auto mb-4" />
                    <p>Данные по режимам пока недоступны.</p>
                  </div>
                )}
              </div>

              {/* Recent Trades Preview */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#e6edf3]">Последние сделки</h3>
                  <button
                    onClick={() => setActiveTab('trades')}
                    className="text-[#58a6ff] hover:text-[#79b8ff] text-sm"
                  >
                    Показать все →
                  </button>
                </div>
                {tradesLoading ? (
                  <div className="text-center py-8 text-[#8b949e]">Загрузка...</div>
                ) : trades && trades.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#30363d]">
                          <th className="text-left py-3 text-[#8b949e] font-medium">Пара</th>
                          <th className="text-left text-[#8b949e] font-medium">Направление</th>
                          <th className="text-left text-[#8b949e] font-medium">Уверенность</th>
                          <th className="text-right text-[#8b949e] font-medium">Прибыль</th>
                          <th className="text-left text-[#8b949e] font-medium">Время</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trades.slice(0, 5).map((trade) => (
                          <tr key={trade.id} className="border-b border-[#30363d]/50">
                            <td className="py-3 text-[#e6edf3]">{trade.pair}</td>
                            <td>
                              <span className={trade.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                                {trade.direction}
                              </span>
                            </td>
                            <td className="text-[#e6edf3]">{trade.confidence?.toFixed(1)}%</td>
                            <td className={`text-right ${(trade.final_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.final_profit ? `${trade.final_profit >= 0 ? '+' : ''}${trade.final_profit.toFixed(2)}%` : '-'}
                            </td>
                            <td className="text-[#8b949e] text-sm">
                              {new Date(trade.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#8b949e]">
                    <p>Сделок пока нет. Запустите агента, чтобы начать торговлю.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TRADES TAB */}
          {activeTab === 'trades' && (
            <div>
              {tradesLoading ? (
                <div className="text-center py-8 text-[#8b949e]">Загрузка...</div>
              ) : !trades || trades.length === 0 ? (
                <div className="text-center py-12 text-[#8b949e]">
                  <AlertTriangle size={48} className="mx-auto mb-4" />
                  <p>Сделок пока нет. Запустите агента, чтобы начать торговлю.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#30363d]">
                        <th className="text-left py-3 text-[#8b949e] font-medium">Пара</th>
                        <th className="text-left text-[#8b949e] font-medium">Направление</th>
                        <th className="text-left text-[#8b949e] font-medium">Уверенность</th>
                        <th className="text-right text-[#8b949e] font-medium">Ставка</th>
                        <th className="text-right text-[#8b949e] font-medium">Цена входа</th>
                        <th className="text-left text-[#8b949e] font-medium">Статус</th>
                        <th className="text-right text-[#8b949e] font-medium">Прибыль</th>
                        <th className="text-left text-[#8b949e] font-medium">Время</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade) => (
                        <>
                          <tr key={trade.id} className="border-b border-[#30363d]/50 hover:bg-[#1a2332]/50">
                            <td className="py-3 text-[#e6edf3] font-medium">{trade.pair}</td>
                            <td>
                              <span className={trade.direction === 'long' ? 'text-green-400' : 'text-red-400'}>
                                {trade.direction}
                              </span>
                            </td>
                            <td className="text-[#e6edf3]">{trade.confidence?.toFixed(1)}%</td>
                            <td className="text-right text-[#e6edf3]">${trade.stake_amount?.toFixed(2)}</td>
                            <td className="text-right text-[#e6edf3]">${trade.entry_price?.toFixed(2)}</td>
                            <td>
                              <span className={`px-2 py-1 rounded text-xs ${
                                trade.status === 'closed'
                                  ? 'bg-[#8b949e]/20 text-[#8b949e]'
                                  : trade.status === 'open'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-yellow-500/20 text-yellow-400'
                              }`}>
                                {trade.status}
                              </span>
                            </td>
                            <td className={`text-right font-medium ${(trade.final_profit || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {trade.final_profit ? `${trade.final_profit >= 0 ? '+' : ''}${trade.final_profit.toFixed(2)}%` : '-'}
                            </td>
                            <td className="text-[#8b949e] text-sm">
                              {new Date(trade.timestamp).toLocaleString()}
                            </td>
                            <td>
                              {trade.signals && (
                                <button
                                  onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                                  className="text-[#8b949e] hover:text-[#e6edf3]"
                                >
                                  {expandedTrade === trade.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedTrade === trade.id && trade.signals && (
                            <tr>
                              <td colSpan={9} className="py-3 px-4 bg-[#0f1419]">
                                <div className="text-sm">
                                  <p className="text-[#8b949e] mb-2">Разбор сигналов:</p>
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                    {Object.entries(trade.signals).map(([key, value]) => (
                                      <div key={key} className="bg-[#161b22] rounded px-3 py-2">
                                        <span className="text-[#8b949e] text-xs block">{key}</span>
                                        <span className="text-[#e6edf3] font-medium">{(value as number).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* WEIGHTS TAB */}
          {activeTab === 'weights' && (
            <div className="space-y-6">
              {weightsLoading ? (
                <div className="text-center py-8 text-[#8b949e]">Загрузка...</div>
              ) : weights && weights.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {weights.map((weight) => (
                      <div key={weight.regime} className="bg-[#0f1419] rounded-lg p-4 border border-[#30363d]">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold text-[#e6edf3]">{weight.regime}</h4>
                          <div className="text-right">
                            <span className="text-sm text-[#8b949e]">Винрейт: </span>
                            <span className={weight.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}>
                              {weight.win_rate.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Weight Bars */}
                        <div className="space-y-3">
                          {[
                            { key: 'price_momentum_weight', label: 'Ценовой импульс', color: '#58a6ff' },
                            { key: 'volume_weight', label: 'Объем', color: '#238636' },
                            { key: 'sentiment_weight', label: 'Сентимент', color: '#f0883e' },
                            { key: 'macro_weight', label: 'Макро', color: '#a371f7' },
                            { key: 'orderbook_weight', label: 'Стакан', color: '#f85149' },
                          ].map(({ key, label, color }) => {
                            const value = weight[key as keyof SignalWeights] as number;
                            return (
                              <div key={key}>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className="text-[#8b949e]">{label}</span>
                                  <span className="text-[#e6edf3]">{(value * 100).toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-[#30363d] rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${value * 100}%`, backgroundColor: color }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#30363d] flex justify-between text-sm">
                          <span className="text-[#8b949e]">Всего сделок: {weight.total_trades}</span>
                          <span className="text-[#8b949e]">
                            Обновлено: {new Date(weight.last_updated).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Weights Comparison Chart */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#30363d]">
                    <h4 className="font-semibold text-[#e6edf3] mb-4">Сравнение весов сигналов</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weights}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                          <XAxis dataKey="regime" stroke="#8b949e" />
                          <YAxis stroke="#8b949e" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}
                            labelStyle={{ color: '#e6edf3' }}
                          />
                          <Legend />
                          <Bar dataKey="price_momentum_weight" name="Ценовой импульс" fill="#58a6ff" />
                          <Bar dataKey="volume_weight" name="Объем" fill="#238636" />
                          <Bar dataKey="sentiment_weight" name="Сентимент" fill="#f0883e" />
                          <Bar dataKey="macro_weight" name="Macro" fill="#a371f7" />
                          <Bar dataKey="orderbook_weight" name="Стакан" fill="#f85149" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-[#8b949e]">
                  <Brain size={48} className="mx-auto mb-4" />
                  <p>Веса сигналов пока не настроены.</p>
                </div>
              )}
            </div>
          )}

          {/* PERFORMANCE TAB */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              {performanceLoading ? (
                <div className="text-center py-8 text-[#8b949e]">Загрузка...</div>
              ) : performance && performance.length > 0 ? (
                <>
                  {/* Daily Performance Chart */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#30363d]">
                    <h4 className="font-semibold text-[#e6edf3] mb-4">Дневная производительность (последние 30 дней)</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performance.slice().reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                          <XAxis dataKey="date" stroke="#8b949e" />
                          <YAxis stroke="#8b949e" />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}
                            labelStyle={{ color: '#e6edf3' }}
                          />
                          <Legend />
                          <Bar dataKey="wins" name="Победы" fill="#238636" />
                          <Bar dataKey="losses" name="Убытки" fill="#f85149" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Win Rate Trend */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#30363d]">
                    <h4 className="font-semibold text-[#e6edf3] mb-4">Тренд винрейта</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={performance.slice().reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                          <XAxis dataKey="date" stroke="#8b949e" />
                          <YAxis stroke="#8b949e" domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d' }}
                            labelStyle={{ color: '#e6edf3' }}
                          />
                          <Line type="monotone" dataKey="win_rate" name="Винрейт %" stroke="#58a6ff" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Performance Table */}
                  <div className="bg-[#0f1419] rounded-lg p-4 border border-[#30363d]">
                    <h4 className="font-semibold text-[#e6edf3] mb-4">Детали дневной производительности</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#30363d]">
                            <th className="text-left py-3 text-[#8b949e] font-medium">Дата</th>
                            <th className="text-right text-[#8b949e] font-medium">Сигналы</th>
                            <th className="text-right text-[#8b949e] font-medium">Победы</th>
                            <th className="text-right text-[#8b949e] font-medium">Убытки</th>
                            <th className="text-right text-[#8b949e] font-medium">Винрейт</th>
                            <th className="text-right text-[#8b949e] font-medium">Средняя прибыль</th>
                            <th className="text-right text-[#8b949e] font-medium">Общая прибыль</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performance.map((day) => (
                            <tr key={day.date} className="border-b border-[#30363d]/50">
                              <td className="py-3 text-[#e6edf3]">{day.date}</td>
                              <td className="text-right text-[#e6edf3]">{day.total_signals}</td>
                              <td className="text-right text-green-400">{day.wins}</td>
                              <td className="text-right text-red-400">{day.losses}</td>
                              <td className={`text-right ${day.win_rate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                {day.win_rate.toFixed(1)}%
                              </td>
                              <td className={`text-right ${day.avg_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {day.avg_profit >= 0 ? '+' : ''}{day.avg_profit.toFixed(2)}%
                              </td>
                              <td className={`text-right ${day.total_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {day.total_profit >= 0 ? '+' : ''}{day.total_profit.toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-[#8b949e]">
                  <TrendingUp size={48} className="mx-auto mb-4" />
                  <p>Данные производительности пока недоступны.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
