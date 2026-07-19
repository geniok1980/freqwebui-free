import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {useAlerts, useAlertCount, useMarkAlertRead} from '../hooks/useApi';
import {theme} from '../theme';
import type {Alert} from '../types';

const alertColors: Record<string, string> = {
  error: theme.colors.danger,
  warning: theme.colors.warning,
  info: theme.colors.info,
  success: theme.colors.success,
};

function AlertRow({item, onPress}: {item: Alert; onPress: (a: Alert) => void}) {
  return (
    <TouchableOpacity
      style={[styles.alertRow, !item.read && styles.alertUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}>
      <View style={[styles.dot, {backgroundColor: alertColors[item.type] || theme.colors.textMuted}]} />
      <View style={{flex: 1}}>
        <View style={styles.alertHeader}>
          <Text style={styles.alertTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.alertTime}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.alertMessage} numberOfLines={2}>{item.message}</Text>
        {item.bot_name && (
          <Text style={styles.alertBot}>{item.bot_name}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function AlertsScreen() {
  const {data: alerts, isLoading, refetch} = useAlerts();
  const {data: count} = useAlertCount();
  const markRead = useMarkAlertRead();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePress = (alert: Alert) => {
    if (!alert.read) {
      markRead.mutate(alert.id);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Уведомления</Text>
        {count !== undefined && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={alerts}
        keyExtractor={item => item.id}
        renderItem={({item}) => <AlertRow item={item} onPress={handlePress} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {isLoading ? 'Загрузка...' : 'Нет уведомлений'}
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
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.text},
  badge: {
    backgroundColor: theme.colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {color: '#fff', fontSize: theme.fontSize.xs, fontWeight: '700'},
  list: {paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: 100},
  empty: {textAlign: 'center', color: theme.colors.textMuted, marginTop: 60},

  alertRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 12,
  },
  alertUnread: {borderLeftWidth: 3, borderLeftColor: theme.colors.primary},
  dot: {width: 8, height: 8, borderRadius: 4, marginTop: 6},
  alertHeader: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4},
  alertTitle: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text, flex: 1},
  alertTime: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted},
  alertMessage: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary},
  alertBot: {fontSize: theme.fontSize.xs, color: theme.colors.primary, marginTop: 4},
});
