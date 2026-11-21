const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '') + '/api';

const TOKEN_KEY = 'gym.token';
const USER_KEY = 'gym.user';

export const session = {
  get token() {
    return sessionStorage.getItem(TOKEN_KEY);
  },
  get user() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },
  save(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Erro ${status}`);
    this.status = status;
    this.details = body?.details;
  }
}

/** Chamada à API com JWT. Devolve { data, headers }. Erros seguem o formato padronizado do backend. */
export async function api(path, { method = 'GET', body, query } = {}) {
  const url = new URL(BASE + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (session.token) headers.Authorization = `Bearer ${session.token}`;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, { message: 'Não foi possível conectar à API (ela pode estar acordando no Render — tente de novo em alguns segundos).' });
  }

  if (res.status === 401 && path !== '/auth/login') {
    session.clear();
    window.dispatchEvent(new Event('gym:logout'));
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return { data, headers: res.headers };
}

export const formatDetails = (err) =>
  Array.isArray(err?.details)
    ? err.details.map((d) => (typeof d === 'string' ? d : `${d.field ?? ''}: ${(d.errors ?? d.messages ?? [d.message]).join(', ')}`)).join(' · ')
    : '';
