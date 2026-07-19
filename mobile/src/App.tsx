import React, {useEffect} from 'react';
import {StatusBar, LogBox} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import {Navigation} from './navigation';
import {useAuthStore} from './store/authStore';
import {api} from './api/client';
import {ErrorBoundary} from './components/common/ErrorBoundary';

LogBox.ignoreLogs(['Reanimated']);

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function AuthGate({children}: {children: React.ReactNode}) {
  const isLoading = useAuthStore(s => s.isLoading);
  const initialize = useAuthStore(s => s.initialize);

  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync().catch(() => {});
    });
  }, [initialize]);

  if (isLoading) {
    return null;
  }

  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    api.setOnUnauthorized(() => {
      useAuthStore.getState().logout();
    });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
        <AuthGate>
          <Navigation />
        </AuthGate>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
