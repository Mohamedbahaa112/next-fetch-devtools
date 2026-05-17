import type { LoggedFetch } from '../types';

const MAX_LOGS = 200;

type Globals = {
  __nfdLogs?: LoggedFetch[];
  __nfdFetchPatched?: boolean;
};

const g = globalThis as unknown as Globals;

if (!g.__nfdLogs) g.__nfdLogs = [];

export function getLogs(): LoggedFetch[] {
  return g.__nfdLogs ?? [];
}

export function clearLogs() {
  if (g.__nfdLogs) g.__nfdLogs.length = 0;
}

export function pushLog(entry: LoggedFetch) {
  const logs = g.__nfdLogs!;
  // Deduplicate: same id OR same method+url within last 100ms
  for (let i = 0; i < Math.min(logs.length, 10); i++) {
    const l = logs[i];
    if (l.id === entry.id) return;
    if (
      l.method === entry.method &&
      l.url === entry.url &&
      Math.abs(l.startedAt - entry.startedAt) < 100
    ) {
      return;
    }
  }
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
}

function headersToObject(h: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  try {
    if (typeof h.forEach === 'function' && !Array.isArray(h)) {
      h.forEach((v: any, k: string) => (out[k] = String(v)));
      return out;
    }
    if (Array.isArray(h)) {
      for (const [k, v] of h) out[k] = String(v);
      return out;
    }
    for (const k of Object.keys(h)) {
      const v = h[k];
      if (v == null) continue;
      out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
    }
  } catch {}
  return out;
}

async function safeReadBody(input: any): Promise<string | null> {
  if (input == null) return null;
  try {
    if (typeof input === 'string') return input;
    if (input instanceof URLSearchParams) return input.toString();
    if (typeof FormData !== 'undefined' && input instanceof FormData) {
      const obj: Record<string, unknown> = {};
      input.forEach((v, k) => {
        obj[k] =
          typeof File !== 'undefined' && v instanceof File ? `[File ${v.name}]` : v;
      });
      return JSON.stringify(obj);
    }
    if (typeof input === 'object') return JSON.stringify(input);
    return String(input);
  } catch {
    return '[unreadable body]';
  }
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type FetchLoggerOptions = {
  enabled?: boolean;
  ignoreUrlPatterns?: (string | RegExp)[];
};

export function installFetchLogger(options: FetchLoggerOptions = {}) {
  const enabled = options.enabled ?? process.env.NODE_ENV !== 'production';
  if (!enabled) return;
  if (g.__nfdFetchPatched) return;
  g.__nfdFetchPatched = true;

  const originalFetch = globalThis.fetch;
  const ignore = options.ignoreUrlPatterns ?? ['/api/__devtools'];

  globalThis.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const startedAt = Date.now();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (
      ignore.some((p) =>
        typeof p === 'string' ? url.includes(p) : p.test(url),
      )
    ) {
      return originalFetch(input as RequestInfo, init);
    }

    const method = (
      init?.method || (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const requestHeaders = headersToObject(
      init?.headers || (input instanceof Request ? input.headers : undefined),
    );
    const requestBody = await safeReadBody(init?.body);

    try {
      const res = await originalFetch(input as RequestInfo, init);
      const clone = res.clone();
      let responseBody = '';
      try {
        responseBody = await clone.text();
        if (responseBody.length > 100_000) {
          responseBody = responseBody.slice(0, 100_000) + '\n...[truncated]';
        }
      } catch {
        responseBody = '[unreadable]';
      }

      pushLog({
        id: newId(),
        source: 'fetch',
        url,
        method,
        status: res.status,
        ok: res.ok,
        durationMs: Date.now() - startedAt,
        startedAt,
        requestHeaders,
        requestBody,
        responseHeaders: headersToObject(res.headers),
        responseBody,
      });

      return res;
    } catch (err) {
      pushLog({
        id: newId(),
        source: 'fetch',
        url,
        method,
        status: 0,
        ok: false,
        durationMs: Date.now() - startedAt,
        startedAt,
        requestHeaders,
        requestBody,
        responseHeaders: {},
        responseBody: '',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}

export function attachAxiosLogger<T extends { interceptors: any }>(
  instance: T,
  options: { enabled?: boolean } = {},
): T {
  const enabled = options.enabled ?? process.env.NODE_ENV !== 'production';
  if (!enabled) return instance;
  if (!instance || (instance as any).__nfdAttached) return instance;
  (instance as any).__nfdAttached = true;

  instance.interceptors.request.use((config: any) => {
    config.__startedAt = Date.now();
    config.__nfdId = newId();
    return config;
  });

  instance.interceptors.response.use(
    async (response: any) => {
      const cfg = response.config || {};
      const startedAt = cfg.__startedAt || Date.now();
      pushLog({
        id: cfg.__nfdId || newId(),
        source: 'axios',
        url: buildAxiosUrl(cfg),
        method: (cfg.method || 'get').toUpperCase(),
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        durationMs: Date.now() - startedAt,
        startedAt,
        requestHeaders: headersToObject(cfg.headers),
        requestBody: await safeReadBody(cfg.data),
        responseHeaders: headersToObject(response.headers),
        responseBody: stringifyData(response.data),
      });
      return response;
    },
    async (error: any) => {
      const cfg = error?.config || {};
      const startedAt = cfg.__startedAt || Date.now();
      const res = error?.response;
      pushLog({
        id: cfg.__nfdId || newId(),
        source: 'axios',
        url: buildAxiosUrl(cfg),
        method: (cfg.method || 'get').toUpperCase(),
        status: res?.status || 0,
        ok: false,
        durationMs: Date.now() - startedAt,
        startedAt,
        requestHeaders: headersToObject(cfg.headers),
        requestBody: await safeReadBody(cfg.data),
        responseHeaders: headersToObject(res?.headers),
        responseBody: res?.data ? stringifyData(res.data) : '',
        error: error?.message || String(error),
      });
      throw error;
    },
  );

  return instance;
}

function buildAxiosUrl(cfg: any): string {
  const base = cfg.baseURL || '';
  const url = cfg.url || '';
  if (!url) return base;
  const full = url.startsWith('http')
    ? url
    : base.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
  if (cfg.params) {
    try {
      const qs = new URLSearchParams(cfg.params).toString();
      if (qs) return full + (full.includes('?') ? '&' : '?') + qs;
    } catch {}
  }
  return full;
}

function stringifyData(data: any): string {
  if (data == null) return '';
  if (typeof data === 'string') {
    if (data.length > 100_000) return data.slice(0, 100_000) + '\n...[truncated]';
    return data;
  }
  try {
    const s = JSON.stringify(data, null, 2);
    if (s.length > 100_000) return s.slice(0, 100_000) + '\n...[truncated]';
    return s;
  } catch {
    return String(data);
  }
}
