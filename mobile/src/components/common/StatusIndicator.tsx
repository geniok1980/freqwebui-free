import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {theme} from '../../theme';
import type {HealthState} from '../../types';

const colors: Record<HealthState, string> = {
  healthy: theme.colors.healthy,
  degraded: theme.colors.degraded,
  unreachable: theme.colors.unreachable,
  unknown: theme.colors.unknown,
};

const labels: Record<HealthState, string> = {
  healthy: 'Работает',
  degraded: 'Нестабилен',
  unreachable: 'Недоступен',
  unknown: 'Неизвестно',
};

interface Props {
  status: HealthState;
  size?: 'sm' | 'md';
}

export function StatusIndicator({status, size = 'sm'}: Props) {
  const dotSize = size === 'md' ? 10 : 8;
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          {width: dotSize, height: dotSize, backgroundColor: colors[status] || colors.unknown},
        ]}
      />
      <Text style={[styles.label, {fontSize: size === 'md' ? theme.fontSize.sm : theme.fontSize.xs}]}>
        {labels[status] || status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', gap: 6},
  dot: {borderRadius: 99},
  label: {color: theme.colors.textSecondary},
});
