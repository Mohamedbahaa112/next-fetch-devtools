'use client';

import { useEffect, useRef, useState } from 'react';
import JsonTree from './JsonTree';

declare const __NFD_VERSION__: string;
const NFD_VERSION = typeof __NFD_VERSION__ !== 'undefined' ? __NFD_VERSION__ : '0.0.0';

type LoggedFetch = {
  id: string;
  url: string;
  method: string;
  status: number;
  ok: boolean;
  durationMs: number;
  startedAt: number;
  source?: 'fetch' | 'axios' | string;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: string;
  error?: string;
};

const POS_KEY = 'nfd_devtools_pos_v1';
const SIZE_KEY = 'nfd_devtools_size_v1';

export type DevtoolsPanelProps = {
  /** Base URL of YOUR API — used by the "Mine" tab filter */
  apiBase?: string;
  /** Endpoint that returns logged server requests. Default: /api/nfd-devtools/fetches */
  endpoint?: string;
  /** URL of the standalone full-page devtools. Default: /__devtools */
  standaloneUrl?: string;
};

function tryPretty(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

export default function DevtoolsPanel(props: DevtoolsPanelProps = {}) {
  const endpoint = props.endpoint ?? '/api/nfd-devtools/fetches';
  const standaloneUrl = props.standaloneUrl ?? '/nfd-devtools';
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LoggedFetch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [failedOnly, setFailedOnly] = useState(false);
  const [scope, setScope] = useState<'mine' | 'external' | 'all'>('all');
  const [detailSearch, setDetailSearch] = useState('');
  const detailSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (detailSearchRef.current) {
          e.preventDefault();
          detailSearchRef.current.focus();
          detailSearchRef.current.select();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const [poppedOut, setPoppedOut] = useState(false);

  const apiBase = (props.apiBase || '').replace(/\/$/, '');

  const [pos, setPos] = useState(() => readPos());
  const [size, setSize] = useState(() => readSize());
  const [leftWidth, setLeftWidth] = useState(45);
  const [maximized, setMaximized] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const splitRef = useRef<{ x: number; w: number; total: number } | null>(null);
  const resizeRef = useRef<{
    sx: number;
    sy: number;
    w: number;
    h: number;
    x: number;
    y: number;
    dir: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tick = async () => {
      let serverLogs: LoggedFetch[] = [];
      try {
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          serverLogs = data.logs || [];
        }
      } catch {}
      const clientLogs: LoggedFetch[] =
        (globalThis as any).__nfdLogs || [];
      const merged = [...clientLogs, ...serverLogs].sort(
        (a, b) => b.startedAt - a.startedAt,
      );
      if (!cancelled) setLogs(merged);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        setPos({
          x: Math.max(0, e.clientX - dragRef.current.dx),
          y: Math.max(0, e.clientY - dragRef.current.dy),
        });
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        const dx = e.clientX - r.sx;
        const dy = e.clientY - r.sy;
        let nx = r.x, ny = r.y, nw = r.w, nh = r.h;
        if (r.dir.includes('e')) nw = Math.max(380, r.w + dx);
        if (r.dir.includes('s')) nh = Math.max(260, r.h + dy);
        if (r.dir.includes('w')) {
          nw = Math.max(380, r.w - dx);
          if (nw !== 380 || r.w - dx >= 380) nx = r.x + dx;
        }
        if (r.dir.includes('n')) {
          nh = Math.max(260, r.h - dy);
          if (nh !== 260 || r.h - dy >= 260) ny = r.y + dy;
        }
        setSize({ w: nw, h: nh });
        setPos({ x: Math.max(0, nx), y: Math.max(0, ny) });
      }
      if (splitRef.current) {
        const s = splitRef.current;
        const dx = e.clientX - s.x;
        const newW = Math.max(20, Math.min(80, ((s.w * s.total) / 100 + dx) * 100 / s.total));
        setLeftWidth(newW);
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
      }
      if (resizeRef.current) {
        resizeRef.current = null;
        try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch {}
      }
      if (splitRef.current) splitRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [pos, size]);

  const startResize = (dir: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    resizeRef.current = {
      sx: e.clientX,
      sy: e.clientY,
      w: size.w,
      h: size.h,
      x: pos.x,
      y: pos.y,
      dir,
    };
  };

  const toggleMax = () => {
    setMinimized(false);
    setMaximized((m) => !m);
  };
  const toggleMin = () => {
    setMaximized(false);
    setMinimized((m) => !m);
  };

  const clear = async () => {
    await fetch(endpoint, { method: 'DELETE' });
    const clientLogs = (globalThis as any).__nfdLogs;
    if (Array.isArray(clientLogs)) clientLogs.length = 0;
    setLogs([]);
    setSelected(null);
    setChecked(new Set());
  };

  // Hide given ids locally (visual delete). Server logs aren't deleted but won't show.
  const hideIds = (ids: Set<string>) => {
    if (!ids.size) return;
    setLogs((prev) => prev.filter((l) => !ids.has(l.id)));
    if (selected && ids.has(selected)) setSelected(null);
    setChecked(new Set());
  };

  const deleteSelected = () => {
    hideIds(checked);
  };

  const keepSelectedOnly = () => {
    if (!checked.size) return;
    setLogs((prev) => prev.filter((l) => checked.has(l.id)));
    if (selected && !checked.has(selected)) setSelected(null);
    setChecked(new Set());
  };

  const selectAllFiltered = () => {
    setChecked(new Set(filtered.map((l) => l.id)));
  };

  const clearSelection = () => setChecked(new Set());

  const popOut = () => {
    window.open(standaloneUrl, '_blank');
    setPoppedOut(true);
  };

  const isMine = (u: string) => !!apiBase && u.startsWith(apiBase);
  const filtered = logs.filter((l) => {
    if (scope === 'mine' && !isMine(l.url)) return false;
    if (scope === 'external' && isMine(l.url)) return false;
    if (filter && !l.url.toLowerCase().includes(filter.toLowerCase())) return false;
    if (methodFilter !== 'ALL' && l.method !== methodFilter) return false;
    if (failedOnly && l.ok && l.status < 400 && l.status !== 0) return false;
    return true;
  });
  const current = logs.find((l) => l.id === selected);
  const failedCount = logs.filter((l) => !l.ok || l.status >= 400 || l.status === 0).length;
  const mineCount = logs.filter((l) => isMine(l.url)).length;
  const externalCount = logs.length - mineCount;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 99999,
          background: '#d4d4d4',
          color: '#333',
          border: 'none',
          borderRadius: '50%',
          width: 48,
          height: 48,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          fontSize: 20,
        }}
        title="Open devtools"
      >
        🐞
      </button>
    );
  }

  if (poppedOut) {
    return (
      <button
        onClick={() => setPoppedOut(false)}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 99999,
          background: '#d4d4d4',
          color: '#333',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        🐞 Popped out — click to show inline
      </button>
    );
  }

  return (
    <div
      dir="ltr"
      style={{
        position: 'fixed',
        left: maximized ? 0 : pos.x,
        top: maximized ? 0 : pos.y,
        zIndex: 99999,
        width: maximized ? '100vw' : size.w,
        height: maximized ? '100vh' : minimized ? 40 : size.h,
        background: '#1e1e1e',
        color: '#e0e0e0',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <div
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') return;
          dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: '#252526',
          borderBottom: '1px solid #333',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <strong style={{ color: '#4fc3f7' }}>
          🐞 ({logs.length}){' '}
          <span style={{ color: '#666', fontWeight: 400, fontSize: 10 }}>
            v{NFD_VERSION}
          </span>
        </strong>
        <input
          placeholder="filter url..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
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
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: failedOnly ? '#e57373' : '#ccc',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          title="Show only failed (4xx, 5xx, errors)"
        >
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(e) => setFailedOnly(e.target.checked)}
          />
          Failed ({failedCount})
        </label>
        {checked.size > 0 && (
          <>
            <span style={{ color: '#fbbf24', fontSize: 11 }}>{checked.size} selected</span>
            <button onClick={deleteSelected} style={btnStyle} title="Delete selected">🗑 Del</button>
            <button onClick={keepSelectedOnly} style={btnStyle} title="Keep selected only, remove the rest">★ Keep</button>
            <button onClick={clearSelection} style={btnStyle} title="Deselect all">○</button>
          </>
        )}
        {checked.size === 0 && filtered.length > 0 && (
          <button onClick={selectAllFiltered} style={btnStyle} title="Select all visible">☐ All</button>
        )}
        <button onClick={popOut} style={btnStyle} title="Open in new tab">⧉</button>
        <button onClick={clear} style={btnStyle} title="Clear everything">Clear</button>
        <button onClick={toggleMin} style={btnStyle} title={minimized ? 'Restore' : 'Minimize'}>
          {minimized ? '▢' : '–'}
        </button>
        <button onClick={toggleMax} style={btnStyle} title={maximized ? 'Restore' : 'Maximize'}>
          {maximized ? '🗗' : '🗖'}
        </button>
        <button onClick={() => setOpen(false)} style={btnStyle}>✕</button>
      </div>

      {!minimized && <>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '6px 8px',
          background: '#1a1a1a',
          borderBottom: '1px solid #333',
        }}
      >
        <TabBtn active={scope === 'mine'} onClick={() => setScope('mine')}>
          Mine ({mineCount})
        </TabBtn>
        <TabBtn active={scope === 'external'} onClick={() => setScope('external')}>
          External ({externalCount})
        </TabBtn>
        <TabBtn active={scope === 'all'} onClick={() => setScope('all')}>
          All ({logs.length})
        </TabBtn>
        <span style={{ marginLeft: 'auto', color: '#666', fontSize: 10, alignSelf: 'center' }}>
          {apiBase || '(no NEXT_PUBLIC_API_BASE_URL)'}
        </span>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ width: `${leftWidth}%`, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 16, color: '#888' }}>
              No requests yet. Navigate around...
            </div>
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
                background: selected === l.id ? '#094771' : checked.has(l.id) ? '#1f3a5c' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(l.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (next.has(l.id)) next.delete(l.id);
                    else next.add(l.id);
                    return next;
                  });
                }}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: 'pointer', accentColor: '#1f6feb' }}
              />
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

        <div
          onMouseDown={(e) => {
            const total = (e.currentTarget.parentElement as HTMLElement).offsetWidth;
            splitRef.current = { x: e.clientX, w: leftWidth, total };
          }}
          style={{
            width: 6,
            cursor: 'col-resize',
            background: '#333',
            flexShrink: 0,
          }}
        />

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
                <TreeBox><JsonTree data={current.requestHeaders} highlight={detailSearch} /></TreeBox>
              </Section>
              {current.requestBody && (
                <Section title="Request Body">
                  <TreeBox>{renderBody(current.requestBody, detailSearch)}</TreeBox>
                </Section>
              )}
              <Section title="Response Headers">
                <TreeBox><JsonTree data={current.responseHeaders} highlight={detailSearch} /></TreeBox>
              </Section>
              <Section title="Response Body">
                <TreeBox>{renderBody(current.responseBody, detailSearch)}</TreeBox>
              </Section>
            </>
          )}
        </div>
      </div>

      {current && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 8px',
            background: '#252526',
            borderTop: '1px solid #333',
          }}
        >
          <span style={{ color: '#888', fontSize: 11 }}>🔍</span>
          <input
            ref={detailSearchRef}
            placeholder="Search in response/headers... (Ctrl+F)"
            value={detailSearch}
            onChange={(e) => setDetailSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDetailSearch('');
            }}
            style={{
              flex: 1,
              background: '#1e1e1e',
              color: '#fff',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '4px 8px',
              outline: 'none',
              fontSize: 12,
            }}
          />
          {detailSearch && (
            <button onClick={() => setDetailSearch('')} style={btnStyle}>
              ✕
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'none' }}>
      </div>
      </>}

      {!maximized && !minimized && <ResizeHandles startResize={startResize} />}
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

function ResizeHandles({
  startResize,
}: {
  startResize: (dir: string) => (e: React.MouseEvent) => void;
}) {
  const edge: React.CSSProperties = { position: 'absolute', background: 'transparent' };
  return (
    <>
      <div onMouseDown={startResize('n')} style={{ ...edge, top: 0, left: 6, right: 6, height: 4, cursor: 'ns-resize' }} />
      <div onMouseDown={startResize('s')} style={{ ...edge, bottom: 0, left: 6, right: 6, height: 4, cursor: 'ns-resize' }} />
      <div onMouseDown={startResize('w')} style={{ ...edge, left: 0, top: 6, bottom: 6, width: 4, cursor: 'ew-resize' }} />
      <div onMouseDown={startResize('e')} style={{ ...edge, right: 0, top: 6, bottom: 6, width: 4, cursor: 'ew-resize' }} />
      <div onMouseDown={startResize('nw')} style={{ ...edge, top: 0, left: 0, width: 8, height: 8, cursor: 'nwse-resize' }} />
      <div onMouseDown={startResize('ne')} style={{ ...edge, top: 0, right: 0, width: 8, height: 8, cursor: 'nesw-resize' }} />
      <div onMouseDown={startResize('sw')} style={{ ...edge, bottom: 0, left: 0, width: 8, height: 8, cursor: 'nesw-resize' }} />
      <div
        onMouseDown={startResize('se')}
        style={{
          ...edge,
          bottom: 0,
          right: 0,
          width: 14,
          height: 14,
          cursor: 'nwse-resize',
          background:
            'linear-gradient(135deg, transparent 50%, #555 50%, #555 60%, transparent 60%, transparent 70%, #555 70%, #555 80%, transparent 80%)',
        }}
      />
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        background: active ? '#094771' : 'transparent',
        color: active ? '#fff' : '#aaa',
        border: '1px solid ' + (active ? '#1f6feb' : '#333'),
        borderRadius: 4,
        padding: '3px 10px',
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}

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
        maxHeight: 300,
        overflow: 'auto',
      }}
    >
      {children}
    </pre>
  );
}

function TreeBox({ children, initialHeight = 240 }: { children: React.ReactNode; initialHeight?: number }) {
  return (
    <div
      style={{
        background: '#0d0d0d',
        padding: 8,
        borderRadius: 4,
        height: initialHeight,
        minHeight: 60,
        overflow: 'auto',
        resize: 'vertical',
        border: '1px solid #2a2a2a',
      }}
    >
      {children}
    </div>
  );
}

function renderBody(body: string, highlight?: string) {
  if (!body) return <span style={{ color: '#666' }}>(empty)</span>;
  try {
    const parsed = JSON.parse(body);
    return <JsonTree data={parsed} highlight={highlight} />;
  } catch {
    return <HighlightedText text={body} highlight={highlight} />;
  }
}

function HighlightedText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight) {
    return (
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#ce9178' }}>
        {text}
      </pre>
    );
  }
  const q = highlight.toLowerCase();
  const lower = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(q, i);
  let key = 0;
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} style={{ background: '#fbbf24', color: '#000', padding: '0 2px' }}>
        {text.slice(idx, idx + highlight.length)}
      </mark>,
    );
    i = idx + highlight.length;
    idx = lower.indexOf(q, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return (
    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#ce9178' }}>
      {parts}
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

function readPos() {
  if (typeof window === 'undefined') return { x: 100, y: 100 };
  try {
    const v = localStorage.getItem(POS_KEY);
    if (v) return JSON.parse(v);
  } catch {}
  return { x: window.innerWidth - 920, y: window.innerHeight - 570 };
}
function readSize() {
  if (typeof window === 'undefined') return { w: 900, h: 550 };
  try {
    const v = localStorage.getItem(SIZE_KEY);
    if (v) return JSON.parse(v);
  } catch {}
  return { w: 900, h: 550 };
}
