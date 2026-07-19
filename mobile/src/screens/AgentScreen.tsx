import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  useAgentStatus,
  useAgentWeights,
  useAgentPerformance,
  useAgentSignals,
  useAgentEnable,
} from '../hooks/useApi';
import {theme} from '../theme';

type Tab = 'overview' | 'weights' | 'signals';

export function AgentScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const {data: status, isLoading, refetch: refetchStatus} = useAgentStatus();
  const {data: weights, refetch: refetchWeights} = useAgentWeights();
  const {data: performance} = useAgentPerformance();
  const {data: signals, refetch: refetchSignals} = useAgentSignals();
  const enableMutation = useAgentEnable();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStatus(), refetchWeights(), refetchSignals()]);
    setRefreshing(false);
  };

  const handleToggle = (value: boolean) => {
    enableMutation.mutate(value, {
      onError: (e: any) => Alert.alert('Ошибка', e.message),
    });
  };

  const renderTab = (tab: Tab, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}>
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Agent Dashboard</Text>
        <Text style={styles.subtitle}>Динамический торговый агент</Text>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Статус агента</Text>
            <Switch
              value={status?.enabled ?? false}
              onValueChange={handleToggle}
              trackColor={{false: theme.colors.border, true: theme.colors.primary}}
              thumbColor={status?.enabled ? '#fff' : '#ccc'}
              disabled={enableMutation.isPending}
            />
          </View>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{status?.current_regime || '—'}</Text>
              <Text style={styles.statusLabel}>Режим рынка</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{status?.total_trades ?? 0}</Text>
              <Text style={styles.statusLabel}>Сделок</Text>
            </View>
            <View style={styles.statusItem}>
              <Text
                style={[
                  styles.statusValue,
                  {color: (status?.win_rate ?? 0) >= 50 ? theme.colors.profitPositive : theme.colors.profitNegative},
                ]}>
                {(status?.win_rate ?? 0).toFixed(1)}%
              </Text>
              <Text style={styles.statusLabel}>Win rate</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {renderTab('overview', 'Обзор')}
          {renderTab('weights', 'Веса')}
          {renderTab('signals', 'Сигналы')}
        </View>

        {activeTab === 'overview' && (
          <>
            {/* Performance */}
            {performance && performance.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Производительность по режимам</Text>
                {performance.map((p: any, i: number) => (
                  <View key={i} style={styles.perfRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.perfRegime}>{p.regime || p.date}</Text>
                      <Text style={styles.perfTrades}>
                        {p.trades} сделок • {p.wins} побед / {p.losses} поражений
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.perfProfit,
                        {color: (p.profit_pct ?? 0) >= 0 ? theme.colors.profitPositive : theme.colors.profitNegative},
                      ]}>
                      {(p.profit_pct ?? 0).toFixed(2)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Quick info */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Информация</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Последний сигнал</Text>
                <Text style={styles.infoValue}>
                  {status?.last_signal ? new Date(status.last_signal).toLocaleString() : '—'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Общая прибыль</Text>
                <Text
                  style={[
                    styles.infoValue,
                    {color: (status?.total_profit ?? 0) >= 0 ? theme.colors.profitPositive : theme.colors.profitNegative},
                  ]}>
                  {status?.total_profit !== undefined ? `$${status.total_profit.toFixed(2)}` : '—'}
                </Text>
              </View>
            </View>
          </>
        )}

        {activeTab === 'weights' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Веса сигналов по режимам</Text>
            {(!weights || weights.length === 0) && (
              <Text style={styles.emptyText}>Нет данных о весах</Text>
            )}
            {(weights || []).map((w: any, i: number) => (
              <View key={i} style={styles.weightCard}>
                <Text style={styles.weightRegime}>{w.regime}</Text>
                <View style={styles.weightRow}>
                  <WeightBar label="Momentum" value={w.price_momentum_weight} color={theme.colors.primary} />
                </View>
                <View style={styles.weightRow}>
                  <WeightBar label="Volume" value={w.volume_weight} color={theme.colors.success} />
                </View>
                <View style={styles.weightRow}>
                  <WeightBar label="Sentiment" value={w.sentiment_weight} color={theme.colors.warning} />
                </View>
                {w.volatility_weight !== undefined && (
                  <View style={styles.weightRow}>
                    <WeightBar label="Volatility" value={w.volatility_weight} color={theme.colors.danger} />
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'signals' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Последние сигналы</Text>
            {(!signals || signals.length === 0) && (
              <Text style={styles.emptyText}>Нет сигналов</Text>
            )}
            {(signals || []).slice(0, 50).map((s: any, i: number) => (
              <View key={i} style={styles.signalRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.signalPair}>{s.pair || '—'}</Text>
                  <Text style={styles.signalDate}>
                    {s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'}
                  </Text>
                </View>
                <View style={{alignItems: 'flex-end'}}>
                  <Text
                    style={[
                      styles.signalAction,
                      {
                        color:
                          s.action === 'buy'
                            ? theme.colors.profitPositive
                            : s.action === 'sell'
                            ? theme.colors.profitNegative
                            : theme.colors.textMuted,
                      },
                    ]}>
                    {s.action?.toUpperCase() || '—'}
                  </Text>
                  <Text style={styles.signalConfidence}>
                    {s.confidence !== undefined ? `${(s.confidence * 100).toFixed(0)}%` : '—'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function WeightBar({label, value, color}: {label: string; value: number; color: string}) {
  return (
    <View style={wbStyles.container}>
      <Text style={wbStyles.label}>{label}</Text>
      <View style={wbStyles.barBg}>
        <View style={[wbStyles.bar, {width: `${Math.min(value * 100, 100)}%`, backgroundColor: color}]} />
      </View>
      <Text style={wbStyles.value}>{(value * 100).toFixed(0)}%</Text>
    </View>
  );
}
const wbStyles = StyleSheet.create({
  container: {flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4},
  label: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted, width: 80},
  barBg: {flex: 1, height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden'},
  bar: {height: 8, borderRadius: 4},
  value: {fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, width: 40, textAlign: 'right'},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.bg},
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.text},
  subtitle: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 2},

  scrollContent: {padding: theme.spacing.lg, paddingBottom: 100},
  emptyText: {textAlign: 'center', color: theme.colors.textMuted, marginVertical: 24},

  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md},
  cardTitle: {fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.sm},

  statusGrid: {flexDirection: 'row', gap: theme.spacing.md},
  statusItem: {flex: 1, alignItems: 'center'},
  statusValue: {fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text},
  statusLabel: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},

  tabBar: {flexDirection: 'row', marginBottom: theme.spacing.md, gap: theme.spacing.sm},
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary},
  tabText: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary},
  tabTextActive: {color: '#fff'},

  // Info rows
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border},
  infoLabel: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted},
  infoValue: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, maxWidth: '60%', textAlign: 'right'},

  // Performance
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  perfRegime: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text},
  perfTrades: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
  perfProfit: {fontSize: theme.fontSize.md, fontWeight: '700', minWidth: 70, textAlign: 'right'},

  // Weights
  weightCard: {
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  weightRegime: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.sm},
  weightRow: {marginVertical: 2},

  // Signals
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  signalPair: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text},
  signalDate: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
  signalAction: {fontSize: theme.fontSize.md, fontWeight: '700'},
  signalConfidence: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
});
