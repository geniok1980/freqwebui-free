import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useAuthStore} from '../store/authStore';
import {theme} from '../theme';
import {api} from '../api/client';

export function LoginScreen() {
  const login = useAuthStore(s => s.login);

  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Ошибка', 'Введите адрес сервера');
      return;
    }
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите логин и пароль');
      return;
    }

    setLoading(true);
    try {
      await api.setBackendOrigin(serverUrl.trim());
      await login(username.trim(), password.trim(), tenantSlug.trim() || undefined);
    } catch (e: any) {
      Alert.alert('Ошибка входа', e.message || 'Не удалось подключиться');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Text style={styles.logo}>⬡</Text>
        <Text style={styles.title}>Freqdash</Text>
        <Text style={styles.subtitle}>Мобильное управление ботами</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Адрес сервера</Text>
          <TextInput
            style={styles.input}
            placeholder="http://192.168.1.100:15000"
            placeholderTextColor={theme.colors.textMuted}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.fieldLabel}>Логин</Text>
          <TextInput
            style={styles.input}
            placeholder="admin"
            placeholderTextColor={theme.colors.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.fieldLabel}>Пароль</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••"
            placeholderTextColor={theme.colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.fieldLabel}>Tenant (опционально)</Text>
          <TextInput
            style={styles.input}
            placeholder="default"
            placeholderTextColor={theme.colors.textMuted}
            value={tenantSlug}
            onChangeText={setTenantSlug}
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.bg},
  content: {flex: 1, justifyContent: 'center', paddingHorizontal: 32},
  logo: {fontSize: 48, color: theme.colors.primary, textAlign: 'center'},
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {gap: 4},
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: theme.colors.bgInput,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {color: '#fff', fontSize: theme.fontSize.lg, fontWeight: '600'},
});
