import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {api} from '../api/client';
import type {Bot, BotMetrics, PortfolioSummary, Alert, Trade} from '../types';

// ── Bots ──

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: async () => {
      const res = await api.get<Bot[]>('/bots');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useBot(id: string) {
  return useQuery({
    queryKey: ['bot', id],
    queryFn: async () => {
      const res = await api.get<Bot>(`/bots/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useBotMetrics(id: string) {
  return useQuery({
    queryKey: ['bot-metrics', id],
    queryFn: async () => {
      const res = await api.get<BotMetrics>(`/bots/${id}/metrics`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });
}

export function useBotTrades(id: string) {
  return useQuery({
    queryKey: ['bot-trades', id],
    queryFn: async () => {
      const res = await api.get<Trade[]>(`/bots/${id}/trades`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useBotHealth(id: string) {
  return useQuery({
    queryKey: ['bot-health', id],
    queryFn: async () => {
      const res = await api.get(`/bots/${id}/health`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useBotControl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'start' | 'stop' | 'restart';
    }) => {
      const res = await api.post(`/bots/${id}/control`, {action});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['bots']});
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bots/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['bots']});
      queryClient.invalidateQueries({queryKey: ['portfolio']});
    },
  });
}

// ── Portfolio ──

export function usePortfolio() {
  return useQuery({
    queryKey: ['portfolio'],
    queryFn: async () => {
      const res = await api.get<PortfolioSummary>('/portfolio/summary');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

// ── Alerts ──

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await api.get<Alert[]>('/alerts');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useAlertCount() {
  return useQuery({
    queryKey: ['alerts-count'],
    queryFn: async () => {
      const res = await api.get<{count: number}>('/alerts/count');
      return res.data.count;
    },
    refetchInterval: 15_000,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (alertId: string) => {
      await api.patch(`/alerts/${alertId}`, {read: true});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['alerts']});
    },
  });
}

// ── Finance Data ──

export function useCryptoPrices() {
  return useQuery({
    queryKey: ['crypto-prices'],
    queryFn: async () => {
      const res = await api.get<any[]>('/finance/crypto/prices');
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useCryptoMovers() {
  return useQuery({
    queryKey: ['crypto-movers'],
    queryFn: async () => {
      const res = await api.get<any[]>('/finance/crypto/movers');
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useNews() {
  return useQuery({
    queryKey: ['news'],
    queryFn: async () => {
      const res = await api.get<any[]>('/finance/news');
      return res.data;
    },
    refetchInterval: 120_000,
  });
}

export function useEconomicIndicators() {
  return useQuery({
    queryKey: ['economic'],
    queryFn: async () => {
      const res = await api.get<any[]>('/finance/economic');
      return res.data;
    },
    refetchInterval: 300_000,
  });
}

// ── Discovery ──

export function useDiscoveryStatus() {
  return useQuery({
    queryKey: ['discovery-status'],
    queryFn: async () => {
      const res = await api.get<any>('/discovery/status');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useTriggerDiscovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<any>('/discovery/trigger');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['discovery-status']});
      queryClient.invalidateQueries({queryKey: ['bots']});
    },
  });
}

// ── Agent ──

export function useAgentStatus() {
  return useQuery({
    queryKey: ['agent-status'],
    queryFn: async () => {
      const res = await api.get<any>('/agent/status');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useAgentWeights() {
  return useQuery({
    queryKey: ['agent-weights'],
    queryFn: async () => {
      const res = await api.get<any[]>('/agent/weights');
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useAgentPerformance() {
  return useQuery({
    queryKey: ['agent-performance'],
    queryFn: async () => {
      const res = await api.get<any[]>('/agent/performance');
      return res.data;
    },
    refetchInterval: 60_000,
  });
}

export function useAgentSignals() {
  return useQuery({
    queryKey: ['agent-signals'],
    queryFn: async () => {
      const res = await api.get<any[]>('/agent/trades');
      return res.data;
    },
    refetchInterval: 30_000,
  });
}

export function useAgentEnable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const endpoint = enabled ? '/agent/enable' : '/agent/disable';
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: ['agent-status']});
    },
  });
}
