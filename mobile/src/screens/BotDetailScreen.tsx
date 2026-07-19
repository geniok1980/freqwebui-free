import React, {useState} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {useBot, useBotMetrics, useBotTrades, useBotControl, useDeleteBot} from '../hooks/useApi';
import {StatusIndicator} from '../components/common/StatusIndicator';
import {theme} from '../theme';
import type {Bot, Trade} from '../types';

interface Props {
  botId: string;
  onBack: () => void;
}

type Tab = 'overview' | 'trades' | 'health';

export function BotDetailScreen({botId, onBack}: Props) {
  const {data: bot, isLoading} = useBot(botId);
  const {data: metrics} = useBotMetrics(botId);
  const {data: trades} = useBotTrades(botId);
  const control = useBotControl();
  const deleteBot = useDeleteBot();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  if (isLoading || !bot) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const profitColor =
    (metrics?.profit_pct ?? 0) >= 0
      ? theme.colors.profitPositive
      : theme.colors.profitNegative;

  const handleControl = (action: 'start' | 'stop' | 'restart') => {
    const labels = {start: 'запустить', stop: 'остановить', restart: 'перезапустить'};
    Alert.alert(`Подтверждение`, `${labels[action]} бота "${bot.name}"?`, [
      {text: 'Отмена', style: 'cancel'},
      {
        text: labels[action].charAt(0).toUpperCase() + labels[action].slice(1),
        onPress: () => control.mutate({id: botId, action}),
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      `Удалить "${bot.name}"?`,
      'Контейнер Docker, user_data и запись в БД будут полностью удалены!',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBot.mutateAsync(botId);
              onBack();
            } catch (e: any) {
              Alert.alert('Ошибка', e.message);
            }
          },
        },
      ],
    );
  };

  const renderTab = (tab: Tab, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}>
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>
        <View style={{flex: 1}} />
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Удалить</Text>
        </TouchableOpacity>
      </View>

      {/* Bot Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.botName}>{bot.name}</Text>
          <StatusIndicator status={bot.health_state} size="md" />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {bot.strategy} • {bot.exchange || '—'}
          </Text>
          {bot.is_dryrun && <Text style={styles.dryrun}>ДЕМО</Text>}
        </View>
      </View>

      {/* Metrics */}
      {metrics && (
        <View style={styles.metricsCard}>
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, {color: profitColor}]}>
                {(metrics.profit_pct ?? 0).toFixed(2)}%
              </Text>
              <Text style={styles.metricLabel}>Прибыль</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.open_positions ?? 0}</Text>
              <Text style={styles.metricLabel}>Открыто</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.closed_trades ?? 0}</Text>
              <Text style={styles.metricLabel}>Сделок</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{(metrics.win_rate ?? 0 * 100).toFixed(0)}%</Text>
              <Text style={styles.metricLabel}>Успех</Text>
            </View>
          </View>
          <View style={styles.metricsSub}>
            <Text style={styles.metricSub}>
              Баланс: ${(metrics.balance ?? 0).toLocaleString()}
            </Text>
            {metrics.drawdown !== undefined && (
              <Text style={styles.metricSub}>
                Просадка: {metrics.drawdown.toFixed(2)}%
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, styles.controlStart]}
          onPress={() => handleControl('start')}
          disabled={control.isPending}>
          <Text style={styles.controlText}>Start</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, styles.controlStop]}
          onPress={() => handleControl('stop')}
          disabled={control.isPending}>
          <Text style={styles.controlText}>Stop</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlBtn, styles.controlRestart]}
          onPress={() => handleControl('restart')}
          disabled={control.isPending}>
          <Text style={styles.controlText}>Restart</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {renderTab('overview', 'Обзор')}
        {renderTab('trades', 'Сделки')}
        {renderTab('health', 'Health')}
      </View>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <ScrollView style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Информация</Text>
          <View style={styles.infoTable}>
            <InfoRow label="Окружение" value={bot.environment} />
            <InfoRow label="API URL" value={bot.api_url || '—'} />
            <InfoRow label="Container ID" value={bot.container_id?.slice(0, 12) || '—'} />
            <InfoRow label="Источник" value={bot.source_mode} />
            <InfoRow label="Последний раз" value={bot.last_seen ? new Date(bot.last_seen).toLocaleString() : '—'} />
          </View>
        </ScrollView>
      )}

      {activeTab === 'trades' && (
        <FlatList
          data={trades || []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => <TradeRow trade={item} />}
          style={styles.tabContent}
          ListEmptyComponent={
            <Text style={styles.empty}>Нет сделок</Text>
          }
        />
      )}

      {activeTab === 'health' && (
        <ScrollView style={styles.tabContent}>
          <Text style={styles.sectionTitle}>Health Check</Text>
          <View style={styles.infoTable}>
            <InfoRow label="Статус" value={bot.health_state} />
            <InfoRow label="Container" value={bot.container_id?.slice(0, 12) || '—'} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function InfoRow({label, value}: {label: string; value: string}) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value} numberOfLines={1}>{value}</Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border},
  label: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted},
  value: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, maxWidth: '60%'},
});

function TradeRow({trade}: {trade: Trade}) {
  const profitColor = (trade.close_profit ?? 0) >= 0 ? theme.colors.profitPositive : theme.colors.profitNegative;
  return (
    <View style={tradeStyles.row}>
      <View style={{flex: 1}}>
        <Text style={tradeStyles.pair}>{trade.pair}</Text>
        <Text style={tradeStyles.date}>
          {new Date(trade.open_date).toLocaleDateString()}
        </Text>
      </View>
      <View style={{alignItems: 'flex-end'}}>
        {trade.close_profit !== undefined && (
          <Text style={[tradeStyles.profit, {color: profitColor}]}>
            {(trade.close_profit * 100).toFixed(2)}%
          </Text>
        )}
        <Text style={tradeStyles.status}>
          {trade.is_open ? 'Открыта' : 'Закрыта'}
        </Text>
      </View>
    </View>
  );
}
const tradeStyles = StyleSheet.create({
  row: {flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border},
  pair: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text},
  date: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
  profit: {fontSize: theme.fontSize.md, fontWeight: '700'},
  status: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
});

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.bg},
  centered: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {padding: 4},
  backText: {color: theme.colors.primary, fontSize: theme.fontSize.md},
  deleteBtn: {padding: 4},
  deleteText: {color: theme.colors.danger, fontSize: theme.fontSize.md},

  infoCard: {
    backgroundColor: theme.colors.bgCard,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  infoRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  botName: {fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8},
  meta: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted},
  dryrun: {fontSize: 10, color: theme.colors.dryRun, backgroundColor: '#f59e0b20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden'},

  metricsCard: {
    backgroundColor: theme.colors.bgCard,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  metricsRow: {flexDirection: 'row'},
  metricItem: {flex: 1, alignItems: 'center'},
  metricValue: {fontSize: theme.fontSize.lg, fontWeight: '700'},
  metricLabel: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
  metricsSub: {flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8},
  metricSub: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted},

  controls: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  controlBtn: {flex: 1, paddingVertical: 10, borderRadius: theme.borderRadius.md, alignItems: 'center'},
  controlStart: {backgroundColor: theme.colors.success},
  controlStop: {backgroundColor: theme.colors.danger},
  controlRestart: {backgroundColor: theme.colors.warning},
  controlText: {color: '#fff', fontSize: theme.fontSize.sm, fontWeight: '600'},

  tabBar: {flexDirection: 'row', marginHorizontal: theme.spacing.lg, gap: theme.spacing.sm, marginBottom: theme.spacing.sm},
  tab: {paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.border},
  tabActive: {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary},
  tabText: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary},
  tabTextActive: {color: '#fff'},

  tabContent: {flex: 1, paddingHorizontal: theme.spacing.lg},
  sectionTitle: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text, marginBottom: theme.spacing.sm},
  empty: {textAlign: 'center', color: theme.colors.textMuted, marginTop: 40},
  infoTable: {marginTop: theme.spacing.sm},
});
