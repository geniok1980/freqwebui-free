import React, {Component, type ReactNode, type ErrorInfo} from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {theme} from '../../theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {hasError: false, error: null};
  }

  static getDerivedStateFromError(error: Error): State {
    return {hasError: true, error};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({hasError: false, error: null});
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>💥</Text>
          <Text style={styles.title}>Что-то пошло не так</Text>
          <Text style={styles.message}>
            {this.state.error?.message || 'Неизвестная ошибка'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Попробовать снова</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emoji: {fontSize: 48, marginBottom: 16},
  title: {fontSize: theme.fontSize.xl, fontWeight: '700', color: theme.colors.text, marginBottom: 12},
  message: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted, textAlign: 'center', marginBottom: 24},
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {color: '#fff', fontSize: theme.fontSize.md, fontWeight: '600'},
});
