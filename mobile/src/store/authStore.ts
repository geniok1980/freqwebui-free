import {create} from 'zustand';
import {api} from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  user: {id: string; username: string; role: string} | null;
  isLoading: boolean;

  initialize: () => Promise<void>;
  login: (username: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  isLoading: true,

  initialize: async () => {
    await api.waitReady();
    if (api.isAuthenticated()) {
      try {
        const res = await api.getCurrentUser();
        set({user: res.data, isAuthenticated: true, isLoading: false});
        return;
      } catch {
        await api.logout();
      }
    }
    set({isLoading: false});
  },

  login: async (username, password, tenantSlug) => {
    await api.login(username, password, tenantSlug);
    const res = await api.getCurrentUser();
    set({user: res.data, isAuthenticated: true});
  },

  logout: async () => {
    await api.logout();
    set({user: null, isAuthenticated: false});
  },

  checkAuth: async () => {
    if (!api.isAuthenticated()) {
      set({user: null, isAuthenticated: false});
      return;
    }
    try {
      const res = await api.getCurrentUser();
      set({user: res.data, isAuthenticated: true});
    } catch {
      await api.logout();
      set({user: null, isAuthenticated: false});
    }
  },
}));
