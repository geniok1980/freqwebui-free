/**
 * Authentication state management with Zustand.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string, tenantSlug?: string) => Promise<void>;
  signup: (payload: { username: string; password: string; tenant_name: string; tenant_slug: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;

  // Role checks
  hasRole: (role: UserRole) => boolean;
  canControlBots: () => boolean;
  canForceExit: () => boolean;
  canManageUsers: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: api.isAuthenticated(),
      isLoading: false,
      error: null,

      // Login action
      login: async (username: string, password: string, tenantSlug: string = 'default') => {
        set({ isLoading: true, error: null });
        try {
          await api.login(username, password, tenantSlug);

          // Fetch user info after login
          const userResponse = await api.getCurrentUser();

          set({
            user: userResponse.data as User,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      signup: async (payload) => {
        set({ isLoading: true, error: null });
        try {
          await api.signup(payload);
          const userResponse = await api.getCurrentUser();
          set({
            user: userResponse.data as User,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Signup failed',
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
          throw error;
        }
      },

      // Logout action
      logout: () => {
        api.logout();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Refresh user data
      refreshUser: async () => {
        if (!api.isAuthenticated()) {
          return;
        }

        try {
          const userResponse = await api.getCurrentUser();
          set({ user: userResponse.data as User });
        } catch (error) {
          // Token might be expired
          get().logout();
        }
      },

      // Update user
      updateUser: (user: User) => set({ user }),

      // Clear error
      clearError: () => set({ error: null }),

      // Role checks
      hasRole: (role: UserRole) => {
        const { user } = get();
        return user?.role === role;
      },

      canControlBots: () => {
        const { user } = get();
        return user?.role === 'admin' || user?.role === 'operator';
      },

      canForceExit: () => {
        const { user } = get();
        return user?.role === 'admin';
      },

      canManageUsers: () => {
        const { user } = get();
        return user?.role === 'admin';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        // Only persist the fact that user is authenticated, not the full user object
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
