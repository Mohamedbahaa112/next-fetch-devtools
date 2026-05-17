'use client';

import { useEffect, useState } from 'react';
import DevtoolsPanel from './DevtoolsPanel';

export type DevtoolsProps = {
  apiBase?: string;
  endpoint?: string;
  standaloneUrl?: string;
  showInProduction?: boolean;
};

type LoggedFetch = {
  id: string;
  url: string;
  method: string;
  status: number;
  ok: boolean;
  durationMs: number;
  startedAt: number;
  source?: string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string;
  error?: string;
};

function clientPushLog(entry: LoggedFetch) {
  const g = window as any;
  if (!g.__nfdLogs) g.__nfdLogs = [];
  const logs: LoggedFetch[] = g.__nfdLogs;
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
  if (logs.length > 200) logs.length = 200;
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
    for (const k of Object.keys(h)) out[k] = String(h[k]);
  } catch {}
  return out;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function installClientFetchLogger() {
  const w = window as any;
  if (w.__nfdClientPatched) return;
  w.__nfdClientPatched = true;

  const originalFetch = window.fetch;
  window.fetch = async function (input: any, init?: any) {
    const startedAt = Date.now();
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input?.url || '';
    if (url.includes('/api/nfd-devtools')) return originalFetch(input, init);

    const method = (
      init?.method || (input?.method) || 'GET'
    ).toUpperCase();
    const requestHeaders = headersToObject(init?.headers || input?.headers);
    let requestBody: string | null = null;
    try {
      if (init?.body) {
        if (typeof init.body === 'string') requestBody = init.body;
        else if (init.body instanceof URLSearchParams) requestBody = init.body.toString();
        else if (init.body instanceof FormData) {
          const obj: any = {};
          init.body.forEach((v, k) => (obj[k] = v instanceof File ? `[File ${v.name}]` : v));
          requestBody = JSON.stringify(obj);
        } else requestBody = '[binary]';
      }
    } catch {}

    try {
      const res = await originalFetch(input, init);
      const clone = res.clone();
      let responseBody = '';
      try {
        responseBody = await clone.text();
        if (responseBody.length > 100_000) responseBody = responseBody.slice(0, 100_000) + '\n...[truncated]';
      } catch {}
      clientPushLog({
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
    } catch (err: any) {
      clientPushLog({
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
        error: err?.message || String(err),
      });
      throw err;
    }
  };

  // Also patch XMLHttpRequest (used by axios in the browser, and by many trackers)
  if (typeof XMLHttpRequest !== 'undefined' && !w.__nfdXhrPatched) {
    w.__nfdXhrPatched = true;
    const OrigXHR = XMLHttpRequest;
    const open = OrigXHR.prototype.open;
    const send = OrigXHR.prototype.send;
    const setHeader = OrigXHR.prototype.setRequestHeader;

    OrigXHR.prototype.open = function (method: string, url: string, ...rest: any[]) {
      (this as any).__nfd = { method, url, headers: {}, startedAt: 0 };
      // @ts-ignore
      return open.call(this, method, url, ...rest);
    };
    OrigXHR.prototype.setRequestHeader = function (k: string, v: string) {
      try {
        (this as any).__nfd.headers[k] = v;
      } catch {}
      return setHeader.call(this, k, v);
    };
    OrigXHR.prototype.send = function (body?: any) {
      const meta = (this as any).__nfd;
      if (meta) {
        meta.startedAt = Date.now();
        meta.body = typeof body === 'string' ? body : body ? '[binary]' : null;
        const url = meta.url;
        if (!url.includes('/api/nfd-devtools')) {
          this.addEventListener('loadend', () => {
            try {
              clientPushLog({
                id: newId(),
                source: 'xhr',
                url: meta.url,
                method: (meta.method || 'GET').toUpperCase(),
                status: this.status,
                ok: this.status >= 200 && this.status < 300,
                durationMs: Date.now() - meta.startedAt,
                startedAt: meta.startedAt,
                requestHeaders: meta.headers,
                requestBody: meta.body,
                responseHeaders: {},
                responseBody:
                  typeof this.responseText === 'string'
                    ? this.responseText.slice(0, 100_000)
                    : '',
              });
            } catch {}
          });
        }
      }
      return send.call(this, body);
    };
  }
}

export default function Devtools(props: DevtoolsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    installClientFetchLogger();
    setMounted(true);
  }, []);
  if (!props.showInProduction && process.env.NODE_ENV === 'production') return null;
  if (!mounted) return null;
  const apiBase =
    props.apiBase ??
    (typeof process !== 'undefined' && process.env
      ? (process.env.NEXT_PUBLIC_API_BASE_URL as string)
      : '');
  return <DevtoolsPanel {...props} apiBase={apiBase} />;
}
