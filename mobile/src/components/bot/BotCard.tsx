import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {theme} from '../../theme';
import {StatusIndicator} from '../common/StatusIndicator';
import type {Bot, BotMetrics} from '../../types';

interface Props {
  bot: Bot;
  metrics?: BotMetrics;
  onPress: (bot: Bot) => void;
}

export function BotCard({bot, metrics, onPress}: Props) {
  const profitColor =
    metrics?.profit_pct !== undefined
      ? metrics.profit_pct >= 0
        ? theme.colors.profitPositive
        : theme.colors.profitNegative
      : theme.colors.textMuted;

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(bot)} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {bot.name}
          </Text>
          {bot.is_dryrun && <Text style={styles.dryrun}>ДЕМО</Text>}
        </View>
        <StatusIndicator status={bot.health_state} />
      </View>

      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.label}>Стратегия</Text>
          <Text style={styles.value} numberOfLines={1}>
            {bot.strategy || '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Биржа</Text>
          <Text style={styles.value}>{bot.exchange || '—'}</Text>
        </View>
      </View>

      {metrics && (
        <View style={styles.metrics}>
          <View style={styles.metricItem}>
            <Text style={[styles.metricValue, {color: profitColor}]}>
              {metrics.profit_pct?.toFixed(2) ?? '—'}%
            </Text>
            <Text style={styles.metricLabel}>Прибыль</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{metrics.open_positions ?? '—'}</Text>
            <Text style={styles.metricLabel}>Открыто</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricValue}>{metrics.closed_trades ?? '—'}</Text>
            <Text style={styles.metricLabel}>Сделок</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  nameRow: {flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1},
  name: {fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text, flexShrink: 1},
  dryrun: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.dryRun,
    backgroundColor: '#f59e0b20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  body: {gap: 4, marginBottom: theme.spacing.md},
  row: {flexDirection: 'row', justifyContent: 'space-between'},
  label: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted},
  value: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, maxWidth: '60%'},
  metrics: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  metricItem: {flex: 1, alignItems: 'center'},
  metricValue: {fontSize: theme.fontSize.lg, fontWeight: '700'},
  metricLabel: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
});
