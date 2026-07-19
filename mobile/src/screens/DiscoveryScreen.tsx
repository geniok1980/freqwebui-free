import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useDiscoveryStatus, useTriggerDiscovery, useBots} from '../hooks/useApi';
import {theme} from '../theme';

export function DiscoveryScreen() {
  const {data: status, isLoading} = useDiscoveryStatus();
  const {data: bots} = useBots();
  const trigger = useTriggerDiscovery();
  const [triggered, setTriggered] = useState(false);

  const handleTrigger = () => {
    trigger.mutate(undefined, {
      onSuccess: (result: any) => {
        setTriggered(true);
        const msg = result?.message
          ? result.message
          : `Найдено: ${result?.discovered ?? '?'}, новых: ${result?.new ?? '?'}, обновлено: ${result?.updated ?? '?'}`;
        Alert.alert('Сканирование завершено', msg);
        setTimeout(() => setTriggered(false), 3000);
      },
      onError: (e: any) => {
        Alert.alert('Ошибка', e.message);
      },
    });
  };

  const discoveredBots = bots?.filter(b => b.source_mode === 'auto') || [];
  const apiBots = bots?.filter(b => b.source_mode === 'api') || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Discovery</Text>
        <Text style={styles.subtitle}>Автоматическое обнаружение ботов</Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={styles.content}>
          {/* Status card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Статус сканирования</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Docker</Text>
              <Text style={[styles.statusValue, {color: status?.docker_enabled ? theme.colors.success : theme.colors.textMuted}]}>
                {status?.docker_enabled ? 'Включён' : 'Отключён'}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Файловая система</Text>
              <Text style={[styles.statusValue, {color: status?.filesystem_enabled ? theme.colors.success : theme.colors.textMuted}]}>
                {status?.filesystem_enabled ? 'Включена' : 'Отключена'}
              </Text>
            </View>
            {status?.last_scan && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Последнее сканирование</Text>
                <Text style={styles.statusValue}>
                  {new Date(status.last_scan).toLocaleString()}
                </Text>
              </View>
            )}
            {status?.next_scan && (
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Следующее</Text>
                <Text style={styles.statusValue}>
                  {new Date(status.next_scan).toLocaleString()}
                </Text>
              </View>
            )}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Интервал</Text>
              <Text style={styles.statusValue}>
                {status?.scan_interval_seconds ? `${status.scan_interval_seconds}с` : '—'}
              </Text>
            </View>
          </View>

          {/* Bot counts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Боты</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Автообнаружено</Text>
              <Text style={styles.statusValue}>{discoveredBots.length}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Добавлено вручную</Text>
              <Text style={styles.statusValue}>{apiBots.length}</Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Всего</Text>
              <Text style={[styles.statusValue, styles.totalValue]}>{bots?.length ?? 0}</Text>
            </View>
          </View>

          {/* Trigger button */}
          <TouchableOpacity
            style={[styles.triggerBtn, (trigger.isPending || triggered) && styles.triggerBtnDisabled]}
            onPress={handleTrigger}
            disabled={trigger.isPending || triggered}>
            {trigger.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.triggerBtnText}>
                {triggered ? '✓ Сканирование запущено' : 'Запустить сканирование'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

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

  centered: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  content: {padding: theme.spacing.lg, gap: theme.spacing.md},

  card: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.lg,
  },
  cardTitle: {fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing.md},
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  statusLabel: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted},
  statusValue: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, textAlign: 'right', maxWidth: '60%'},
  totalValue: {fontSize: theme.fontSize.lg, fontWeight: '700', color: theme.colors.text},

  triggerBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  triggerBtnDisabled: {opacity: 0.6},
  triggerBtnText: {color: '#fff', fontSize: theme.fontSize.md, fontWeight: '600'},
});
