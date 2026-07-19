import AsyncStorage from '@react-native-async-storage/async-storage';
import type {ApiResponse, TokenResponse} from '../types';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  BACKEND_ORIGIN: 'backend_origin',
  TENANT_SLUG: 'tenant_slug',
} as const;

type AuthEventCallback = () => void;

export class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tenantSlug: string = 'default';
  private onUnauthorized: AuthEventCallback | null = null;
  private ready: Promise<void>;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '';
    this.ready = this._hydrate();
  }

  private async _hydrate(): Promise<void> {
    try {
      const [token, refresh, origin, slug] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        AsyncStorage.getItem(STORAGE_KEYS.BACKEND_ORIGIN),
        AsyncStorage.getItem(STORAGE_KEYS.TENANT_SLUG),
      ]);
      this.accessToken = token;
      this.refreshToken = refresh;
      this.tenantSlug = slug || 'default';
      if (origin) {
        this.baseUrl = `${origin}/api/v1`;
      }
    } catch {
      // defaults are fine
    }
  }

  /** Ждём гидрации стоража перед первым запросом */
  async waitReady(): Promise<void> {
    await this.ready;
  }

  setOnUnauthorized(cb: AuthEventCallback | null): void {
    this.onUnauthorized = cb;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async setBackendOrigin(origin: string): Promise<void> {
    const normalized = origin.replace(/\/+$/, '');
    this.baseUrl = `${normalized}/api/v1`;
    await AsyncStorage.setItem(STORAGE_KEYS.BACKEND_ORIGIN, normalized);
  }

  getTenantSlug(): string {
    return this.tenantSlug;
  }

  async setTenantSlug(slug: string): Promise<void> {
    this.tenantSlug = slug.toLowerCase().trim();
    await AsyncStorage.setItem(STORAGE_KEYS.TENANT_SLUG, this.tenantSlug);
  }

  async setAccessToken(token: string | null): Promise<void> {
    this.accessToken = token;
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  async setRefreshToken(token: string | null): Promise<void> {
    this.refreshToken = token;
    if (token) {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  private getHeaders(includeAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': this.tenantSlug,
    };
    if (includeAuth && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    return headers;
  }

  async request<T>(
    method: string,
    endpoint: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | string[]>;
      includeAuth?: boolean;
    },
  ): Promise<ApiResponse<T>> {
    await this.ready;

    const {body, params, includeAuth = true} = options || {};

    if (includeAuth && !this.accessToken) {
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    let url = `${this.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers: this.getHeaders(includeAuth),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      await this.setAccessToken(null);
      this.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const detail = data?.detail ?? data?.error ?? data?.message;
      if (typeof detail === 'string' && detail.trim()) {
        throw new Error(detail);
      }
      if (Array.isArray(detail) && detail.length) {
        const msg = detail
          .map((d: any) => d?.msg || d?.message || (typeof d === 'string' ? d : JSON.stringify(d)))
          .filter(Boolean)
          .join('; ');
        if (msg) {
          throw new Error(msg);
        }
      }
      if (detail) {
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
      throw new Error(`API error: ${response.status}`);
    }

    return data;
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | string[]>,
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, {params});
  }

  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, {body});
  }

  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, {body});
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, {body});
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  // ── Auth endpoints ──

  async login(
    username: string,
    password: string,
    tenantSlug?: string,
  ): Promise<TokenResponse> {
    const slug = tenantSlug || this.tenantSlug;
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Tenant-Slug': slug,
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.detail || data.message || 'Login failed');
    }

    if (data.data?.access_token) {
      await this.setAccessToken(data.data.access_token);
      if (data.data.refresh_token) {
        await this.setRefreshToken(data.data.refresh_token);
      }
      await this.setTenantSlug(slug);
    }

    return data.data;
  }

  async refreshTokenRequest(): Promise<TokenResponse | null> {
    if (!this.refreshToken) {
      return null;
    }
    try {
      const response = await this.post<TokenResponse>('/auth/refresh', {
        refresh_token: this.refreshToken,
      });
      if (response.data.access_token) {
        await this.setAccessToken(response.data.access_token);
        if (response.data.refresh_token) {
          await this.setRefreshToken(response.data.refresh_token);
        }
      }
      return response.data;
    } catch {
      await this.setAccessToken(null);
      await this.setRefreshToken(null);
      return null;
    }
  }

  async logout(): Promise<void> {
    await Promise.all([
      this.setAccessToken(null),
      this.setRefreshToken(null),
    ]);
  }

  async getCurrentUser() {
    return this.get<{id: string; username: string; role: string}>('/auth/me');
  }
}

export const api = new ApiClient();
