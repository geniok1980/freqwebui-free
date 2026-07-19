import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useBots, usePortfolio} from '../hooks/useApi';
import {BotCard} from '../components/bot/BotCard';
import {theme} from '../theme';
import type {Bot, HealthState} from '../types';

interface Props {
  onBotPress: (bot: Bot) => void;
  onLogout: () => void;
}

const FILTERS: Array<{key: HealthState | 'all'; label: string}> = [
  {key: 'all', label: 'Все'},
  {key: 'healthy', label: 'Работают'},
  {key: 'degraded', label: 'Нестабильны'},
  {key: 'unreachable', label: 'Недоступны'},
];

export function DashboardScreen({onBotPress, onLogout}: Props) {
  const {data: bots, isLoading, refetch} = useBots();
  const {data: portfolio} = usePortfolio();
  const [filter, setFilter] = useState<HealthState | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const filtered = filter === 'all' ? bots : bots?.filter(b => b.health_state === filter);
  const alertCount = bots?.filter(b => b.health_state === 'unreachable' || b.health_state === 'degraded').length ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Freqdash</Text>
          <Text style={styles.subtitle}>
            {bots?.length ?? 0} ботов • {alertCount > 0 && `${alertCount} требуют внимания`}
          </Text>
        </View>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Выйти</Text>
        </TouchableOpacity>
      </View>

      {/* Portfolio Summary */}
      {portfolio && (
        <View style={styles.portfolio}>
          <View style={styles.portfolioRow}>
            <View style={styles.portfolioItem}>
              <Text
                style={[
                  styles.portfolioValue,
                  {color: (portfolio.total_profit_pct ?? 0) >= 0 ? theme.colors.profitPositive : theme.colors.profitNegative},
                ]}>
                {(portfolio.total_profit_pct ?? 0).toFixed(2)}%
              </Text>
              <Text style={styles.portfolioLabel}>Общая прибыль</Text>
            </View>
            <View style={styles.portfolioItem}>
              <Text style={styles.portfolioValue}>
                ${(portfolio.total_balance ?? 0).toLocaleString()}
              </Text>
              <Text style={styles.portfolioLabel}>Баланс</Text>
            </View>
            <View style={styles.portfolioItem}>
              <Text style={styles.portfolioValue}>{portfolio.total_open_positions}</Text>
              <Text style={styles.portfolioLabel}>Открыто</Text>
            </View>
          </View>
          {portfolio.best_performer && (
            <Text style={styles.bestPerformer}>
              Лучший: {portfolio.best_performer}
            </Text>
          )}
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bot List */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({item}) => <BotCard bot={item} onPress={onBotPress} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? 'Загрузка...' : 'Нет ботов'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.bg},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  greeting: {fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.text},
  subtitle: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 2},
  logoutBtn: {padding: 8},
  logoutText: {color: theme.colors.danger, fontSize: theme.fontSize.sm},

  portfolio: {
    backgroundColor: theme.colors.bgCard,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  portfolioRow: {flexDirection: 'row', gap: theme.spacing.md},
  portfolioItem: {flex: 1, alignItems: 'center'},
  portfolioValue: {fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text},
  portfolioLabel: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
  bestPerformer: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },

  filters: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary},
  filterText: {fontSize: theme.fontSize.xs, color: theme.colors.textSecondary},
  filterTextActive: {color: '#fff'},

  list: {paddingHorizontal: theme.spacing.lg, paddingBottom: 100},
  empty: {textAlign: 'center', color: theme.colors.textMuted, marginTop: 60},
});
