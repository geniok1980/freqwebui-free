/**
 * Main application component with routing.
 */

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import { initTheme } from './styles/theme';
import { Layout } from './components/common/Layout';
import { ToastContainer } from './components/common/Toast';
import Login from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { BotDetail } from './pages/BotDetail';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { Compare } from './pages/Compare';
import { UserManagement } from './pages/UserManagement';
import { Alerts } from './pages/Alerts';
import { Discovery } from './pages/Discovery';
import { Historic } from './pages/Historic';
import { Backtest } from './pages/Backtest';
import { StrategyLab } from './pages/StrategyLab';
import { StrategyList } from './pages/StrategyLab/StrategyList';
import { WorkflowControl } from './pages/StrategyLab/WorkflowControl';
import { HyperoptMonitor } from './pages/StrategyLab/HyperoptMonitor';
import { OptimizationResults } from './pages/StrategyLab/OptimizationResults';
import { FinanceData } from './pages/FinanceData';
import { AgentDashboard } from './pages/Agent';
import { PairlistSelector } from './pages/PairlistSelector';
import { FreqtradeBots } from './pages/FreqtradeBots';
import { PreLaunchChecklist } from './pages/PreLaunchChecklist';
import { ScoringDashboard } from './pages/ScoringDashboard';
import { RiskDashboard } from './pages/RiskDashboard';
import { TradingJournal } from './pages/TradingJournal';
import { ComparisonView } from './pages/ComparisonView';
import { setTenantSlug } from './services/api';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 seconds
      retry: 1,
    },
  },
});

/**
 * Protected route wrapper that redirects to login if not authenticated.
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * Main App component.
 */
function App() {
  const logout = useAuthStore((state) => state.logout);

  // If running inside a bundled mobile shell (Capacitor) we need a backend configured.
  // On Android, the protocol may be http(s)://localhost, so don't rely on protocol alone.
  const isCapacitorNative = typeof (window as any).Capacitor !== 'undefined';
  const needsSetup = isCapacitorNative && !localStorage.getItem('dashboard_backend_origin');

  // Initialize theme on mount
  useEffect(() => {
    initTheme();
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 't' && parts[1]) {
      setTenantSlug(parts[1]);
    }
  }, []);

  // Listen for unauthorized events (401) and redirect to login
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [logout]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastContainer />
        <Routes>
          {/* Public routes */}
          <Route path="/setup" element={<Setup />} />
          <Route
            path="/login"
            element={needsSetup ? <Navigate to="/setup" replace /> : <Login />}
          />
          <Route
            path="/t/:tenantSlug/login"
            element={needsSetup ? <Navigate to="/setup" replace /> : <Login />}
          />
          <Route
            path="/signup"
            element={needsSetup ? <Navigate to="/setup" replace /> : <Signup />}
          />
          <Route
            path="/t/:tenantSlug/signup"
            element={needsSetup ? <Navigate to="/setup" replace /> : <Signup />}
          />

          {/* If setup is required, force all other routes to /setup */}
          {needsSetup ? (
            <Route path="*" element={<Navigate to="/setup" replace />} />
          ) : null}

          {/* Protected routes with Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/freqtrade-bots"
            element={
              <ProtectedRoute>
                <FreqtradeBots />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bots/:botId"
            element={
              <ProtectedRoute>
                <BotDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute>
                <Compare />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <AdminRoute>
                  <UserManagement />
                </AdminRoute>
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <Alerts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/discovery"
            element={
              <ProtectedRoute>
                <Discovery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/historic"
            element={
              <ProtectedRoute>
                <Historic />
              </ProtectedRoute>
            }
          />
          <Route
            path="/backtest"
            element={
              <ProtectedRoute>
                <Backtest />
              </ProtectedRoute>
            }
          />

          {/* Strategy Lab Routes (V6) */}
          <Route
            path="/strategy-lab"
            element={
              <ProtectedRoute>
                <StrategyLab />
              </ProtectedRoute>
            }
          />
          <Route
            path="/strategy-lab/strategies"
            element={
              <ProtectedRoute>
                <StrategyList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/strategy-lab/workflow/:botId?"
            element={
              <ProtectedRoute>
                <WorkflowControl />
              </ProtectedRoute>
            }
          />
          <Route
            path="/strategy-lab/hyperopt/:strategyName?"
            element={
              <ProtectedRoute>
                <HyperoptMonitor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/strategy-lab/results"
            element={
              <ProtectedRoute>
                <OptimizationResults />
              </ProtectedRoute>
            }
          />

          {/* Pairlist Selector Route */}
          <Route
            path="/pairlist-selector"
            element={
              <ProtectedRoute>
                <PairlistSelector />
              </ProtectedRoute>
            }
          />

          {/* FinanceData Route (AlexFinanceData Integration) */}
          <Route
            path="/financedata"
            element={
              <ProtectedRoute>
                <FinanceData />
              </ProtectedRoute>
            }
          />

          {/* Agent Strategy Route (V8) */}
          <Route
            path="/agent"
            element={
              <ProtectedRoute>
                <AgentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Чек-лист запуска */}
          <Route
            path="/checklist"
            element={
              <ProtectedRoute>
                <PreLaunchChecklist />
              </ProtectedRoute>
            }
          />

          {/* Оценка стратегий */}
          <Route
            path="/scoring"
            element={
              <ProtectedRoute>
                <ScoringDashboard />
              </ProtectedRoute>
            }
          />

          {/* Сравнение B↔D↔L */}
          <Route
            path="/comparison"
            element={
              <ProtectedRoute>
                <ComparisonView />
              </ProtectedRoute>
            }
          />

          {/* Риски */}
          <Route
            path="/risk"
            element={
              <ProtectedRoute>
                <RiskDashboard />
              </ProtectedRoute>
            }
          />

          {/* Журнал торговли */}
          <Route
            path="/journal"
            element={
              <ProtectedRoute>
                <TradingJournal />
              </ProtectedRoute>
            }
          />

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
