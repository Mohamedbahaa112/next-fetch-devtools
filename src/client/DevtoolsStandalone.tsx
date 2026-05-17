'use client';

import { useEffect, useState } from 'react';

export type DevtoolsStandaloneProps = {
  endpoint?: string;
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

function tryPretty(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function DevtoolsStandalone(props: DevtoolsStandaloneProps = {}) {
  const endpoint = props.endpoint ?? '/api/__devtools/fetches';
  const [logs, setLogs] = useState<LoggedFetch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [failedOnly, setFailedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLogs(data.logs || []);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const clear = async () => {
    await fetch(endpoint, { method: 'DELETE' });
    setLogs([]);
    setSelected(null);
  };

  const filtered = logs.filter((l) => {
    if (filter && !l.url.toLowerCase().includes(filter.toLowerCase())) return false;
    if (methodFilter !== 'ALL' && l.method !== methodFilter) return false;
    if (failedOnly && l.ok && l.status < 400 && l.status !== 0) return false;
    return true;
  });
  const current = logs.find((l) => l.id === selected);
  const failedCount = logs.filter((l) => !l.ok || l.status >= 400 || l.status === 0).length;

  return (
    <div
      dir="ltr"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e1e',
        color: '#e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#252526',
          borderBottom: '1px solid #333',
        }}
      >
        <strong style={{ color: '#4fc3f7', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          🐞 ({logs.length})
        </strong>
        <input
          placeholder="filter url..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            flex: 1,
            background: '#1e1e1e',
            color: '#fff',
            border: '1px solid #333',
            borderRadius: 4,
            padding: '4px 8px',
            outline: 'none',
          }}
        />
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="ALL">All methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: failedOnly ? '#e57373' : '#ccc',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(e) => setFailedOnly(e.target.checked)}
          />
          Failed ({failedCount})
        </label>
        <button onClick={clear} style={btnStyle}>Clear</button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: '45%', overflowY: 'auto', borderRight: '1px solid #333' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 16, color: '#888' }}>No requests yet.</div>
          )}
          {filtered.map((l) => (
            <div
              key={l.id}
              onClick={() => setSelected(l.id)}
              title={l.url}
              style={{
                padding: '4px 8px',
                cursor: 'pointer',
                borderBottom: '1px solid #2a2a2a',
                background: selected === l.id ? '#094771' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span style={{ color: methodColor(l.method), fontWeight: 700, minWidth: 42, fontSize: 11 }}>
                {l.method}
              </span>
              <span style={{ color: statusColor(l.status), minWidth: 28, fontSize: 11 }}>
                {l.status || 'ERR'}
              </span>
              <span
                style={{
                  color: '#ccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  direction: 'rtl',
                  textAlign: 'left',
                }}
              >
                {shortenUrl(l.url)}
              </span>
              <span style={{ color: '#888', fontSize: 10 }}>{l.durationMs}ms</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {!current && <div style={{ color: '#888' }}>Select a request to inspect</div>}
          {current && (
            <>
              <Section title="URL">
                <code style={{ color: '#ce9178', wordBreak: 'break-all' }}>{current.url}</code>
              </Section>
              <Section title="Status">
                <span style={{ color: statusColor(current.status) }}>
                  {current.status} {current.error ? `— ${current.error}` : ''}
                </span>
                {current.source && (
                  <span style={{ color: '#888', marginLeft: 8 }}>· {current.source}</span>
                )}
              </Section>
              <Section title="Request Headers">
                <Pre>{JSON.stringify(current.requestHeaders, null, 2)}</Pre>
              </Section>
              {current.requestBody && (
                <Section title="Request Body">
                  <Pre>{tryPretty(current.requestBody)}</Pre>
                </Section>
              )}
              <Section title="Response Headers">
                <Pre>{JSON.stringify(current.responseHeaders, null, 2)}</Pre>
              </Section>
              <Section title="Response Body">
                <Pre>{tryPretty(current.responseBody)}</Pre>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#333',
  color: '#fff',
  border: '1px solid #555',
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
};

const selectStyle: React.CSSProperties = {
  background: '#1e1e1e',
  color: '#fff',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '4px 6px',
  outline: 'none',
  cursor: 'pointer',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: '#4fc3f7', fontWeight: 700, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre
      style={{
        background: '#0d0d0d',
        padding: 8,
        borderRadius: 4,
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: 400,
        overflow: 'auto',
      }}
    >
      {children}
    </pre>
  );
}

function methodColor(m: string) {
  return { GET: '#4caf50', POST: '#ffb74d', PUT: '#64b5f6', DELETE: '#e57373', PATCH: '#ba68c8' }[m] || '#fff';
}
function statusColor(s: number) {
  if (s === 0) return '#e57373';
  if (s >= 500) return '#e57373';
  if (s >= 400) return '#ffb74d';
  if (s >= 300) return '#64b5f6';
  if (s >= 200) return '#4caf50';
  return '#888';
}
function shortenUrl(u: string) {
  try {
    const url = new URL(u);
    return url.pathname + url.search;
  } catch {
    return u;
  }
}
