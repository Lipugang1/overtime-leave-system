'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '@/lib/auth-shared';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  updateProfile: (data: { name?: string; phone?: string; department?: string; module?: string; squad?: string }) => Promise<void>;
}

interface RegisterData {
  username: string;
  password: string;
  name: string;
  role_category: string;
  position: string;
  department?: string;
  module?: string;
  squad?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('auth_token');
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // 带上 eo_token 参数确保通过 EdgeOne 鉴权
    const sep = url.includes('?') ? '&' : '?';
    const eoParam = new URLSearchParams(window.location.search).get('eo_token');
    if (eoParam) {
      const eoTime = new URLSearchParams(window.location.search).get('eo_time');
      url = `${url}${sep}eo_token=${eoParam}${eoTime ? `&eo_time=${eoTime}` : ''}`;
    }
    return fetch(url, { ...options, headers });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
        localStorage.removeItem('auth_token');
      }
    } catch {
      setUser(null);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (username: string, password: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    // 带上 eo_token 确保通过 EdgeOne 鉴权
    let url = '/api/auth/login';
    const eoParam = new URLSearchParams(window.location.search).get('eo_token');
    if (eoParam) {
      const eoTime = new URLSearchParams(window.location.search).get('eo_time');
      url = `${url}?eo_token=${eoParam}${eoTime ? `&eo_time=${eoTime}` : ''}`;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`服务器返回异常 (${res.status}): ${text.slice(0, 100)}`);
      }
      if (!res.ok) throw new Error(data.error || '登录失败');
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error('请求超时，请检查网络连接');
      throw err;
    }
  };

  const register = async (regData: RegisterData) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let url = '/api/auth/register';
    const eoParam = new URLSearchParams(window.location.search).get('eo_token');
    if (eoParam) {
      const eoTime = new URLSearchParams(window.location.search).get('eo_time');
      url = `${url}?eo_token=${eoParam}${eoTime ? `&eo_time=${eoTime}` : ''}`;
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`服务器返回异常 (${res.status}): ${text.slice(0, 100)}`);
      }
      if (!res.ok) throw new Error(data.error || '注册失败');
      localStorage.setItem('auth_token', data.token);
      setUser(data.user);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') throw new Error('请求超时，请检查网络连接');
      throw err;
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  const updateProfile = async (profileData: { name?: string; phone?: string; department?: string; module?: string; squad?: string }) => {
    const res = await fetchWithAuth('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '更新失败');
    await refresh();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, fetchWithAuth, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
