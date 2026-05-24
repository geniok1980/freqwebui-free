/**
 * API client for communicating with the dashboard backend.
 */

import type { ApiResponse, TokenResponse } from '../types';

const BACKEND_ORIGIN_STORAGE_KEY = 'dashboard_backend_origin';
const TENANT_SLUG_STORAGE_KEY = 'dashboard_tenant_slug';

function normalizeOrigin(raw: string): string {
  let u = raw.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  u = u.replace(/\/+$/, '');
  return u;
}

export function getBackendOrigin(): string | null {
  const raw = localStorage.getItem(BACKEND_ORIGIN_STORAGE_KEY);
  if (!raw) return null;
  const norm = normalizeOrigin(raw);
  return norm || null;
}

export function setBackendOrigin(origin: string | null) {
  if (!origin) {
    localStorage.removeItem(BACKEND_ORIGIN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(BACKEND_ORIGIN_STORAGE_KEY, normalizeOrigin(origin));
}

export function getTenantSlug(): string {
  return localStorage.getItem(TENANT_SLUG_STORAGE_KEY) || 'default';
}

export function setTenantSlug(slug: string | null) {
  if (!slug) {
    localStorage.removeItem(TENANT_SLUG_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TENANT_SLUG_STORAGE_KEY, slug.trim().toLowerCase());
}

function resolveApiBaseUrl(): string {
  // 1) Explicit build-time override (normal web deployments)
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl;

  // 2) Runtime override (Android APK bundles the UI and points to a backend IP)
  const origin = getBackendOrigin();
  if (origin) return `${origin}/api/v1`;

  // 3) Default: same-origin web app (served behind reverse proxy)
  // NOTE: when running inside Capacitor without a configured backend, this won't work.
  return '/api/v1';
}

export const API_BASE_URL = resolveApiBaseUrl();

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Try to restore token from localStorage
    this.accessToken = localStorage.getItem('access_token');
  }

  /**
   * Set/override the API base URL at runtime.
   * Useful for Capacitor builds where the UI is bundled in the APK.
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }

  /**
   * Get current API base URL.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set the access token for authenticated requests.
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  /**
   * Get the current access token.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  /**
   * Build headers for API requests.
   */
  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  /**
   * Make an API request.
   */
  async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: unknown;
      params?: Record<string, string | number | boolean | string[]>;
      includeAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const { body, params, includeAuth = true } = options;

    let url = `${this.baseUrl}${endpoint}`;

    // Add query parameters
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, v));
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        ...this.getHeaders(includeAuth),
        'X-Tenant-Slug': getTenantSlug(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle 401 Unauthorized
    if (response.status === 401) {
      this.setAccessToken(null);
      // Dispatch event for auth state change - triggers redirect to login
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API error: ${response.status}`);
    }

    return data;
  }

  /**
   * GET request helper.
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | string[]>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', endpoint, { params });
  }

  /**
   * POST request helper.
   */
  async post<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', endpoint, { body });
  }

  /**
   * PUT request helper.
   */
  async put<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', endpoint, { body });
  }

  /**
   * PATCH request helper.
   */
  async patch<T>(endpoint: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', endpoint, { body });
  }

  /**
   * DELETE request helper.
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', endpoint);
  }

  // Auth endpoints
  async login(username: string, password: string, tenantSlug: string = 'default'): Promise<TokenResponse> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${this.baseUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Tenant-Slug': tenantSlug,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.detail || data.message || 'Login failed');
    }

    // Store the token
    if (data.data?.access_token) {
      this.setAccessToken(data.data.access_token);
      setTenantSlug(tenantSlug);
    }

    return data.data;
  }

  async signup(payload: {
    username: string;
    password: string;
    tenant_name: string;
    tenant_slug: string;
  }): Promise<TokenResponse> {
    const response = await fetch(`${this.baseUrl}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.detail || data.message || 'Signup failed');
    }
    if (data.data?.access_token) {
      this.setAccessToken(data.data.access_token);
      setTenantSlug(payload.tenant_slug);
    }
    return data.data;
  }

  logout(): void {
    this.setAccessToken(null);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await this.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    if (response.data.access_token) {
      this.setAccessToken(response.data.access_token);
    }
    return response.data;
  }

  async getCurrentUser() {
    return this.get('/auth/me');
  }
}

// Export singleton instance
export const api = new ApiClient();

// Export class for testing
export { ApiClient };
