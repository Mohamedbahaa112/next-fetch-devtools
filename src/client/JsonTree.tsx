'use client';

import { useState } from 'react';

type Props = {
  data: any;
  name?: string;
  defaultExpanded?: boolean;
  depth?: number;
  highlight?: string;
};

const COLORS = {
  key: '#9cdcfe',
  string: '#ce9178',
  number: '#b5cea8',
  boolean: '#569cd6',
  null: '#808080',
  punct: '#d4d4d4',
  meta: '#808080',
  toggle: '#888',
};

export default function JsonTree({
  data,
  name,
  defaultExpanded = true,
  depth = 0,
  highlight,
}: Props) {
  return (
    <div
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        lineHeight: '1.5',
      }}
    >
      <Node
        value={data}
        name={name}
        depth={depth}
        defaultExpanded={defaultExpanded}
        highlight={highlight}
      />
    </div>
  );
}

function highlightText(text: string, query?: string) {
  if (!query) return text;
  const q = query.toLowerCase();
  const t = String(text);
  const idx = t.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {t.slice(0, idx)}
      <mark
        style={{
          background: '#fbbf24',
          color: '#000',
          padding: '0 2px',
          borderRadius: 2,
        }}
      >
        {t.slice(idx, idx + query.length)}
      </mark>
      {t.slice(idx + query.length)}
    </>
  );
}

function Node({
  value,
  name,
  depth,
  defaultExpanded,
  lastInParent,
  highlight,
}: {
  value: any;
  name?: string | number;
  depth: number;
  defaultExpanded: boolean;
  lastInParent?: boolean;
  highlight?: string;
}) {
  const [open, setOpen] = useState(defaultExpanded && depth < 2);

  const isArr = Array.isArray(value);
  const isObj = value !== null && typeof value === 'object' && !isArr;
  const isComposite = isArr || isObj;

  const nameStr = name === undefined ? '' : typeof name === 'number' ? String(name) : `"${name}"`;
  const keyLabel =
    name !== undefined ? (
      <>
        <span style={{ color: COLORS.key }}>
          {highlightText(nameStr, highlight)}
        </span>
        <span style={{ color: COLORS.punct }}>: </span>
      </>
    ) : null;

  if (!isComposite) {
    return (
      <div style={{ paddingLeft: depth * 14, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        <span style={{ display: 'inline-block', width: 12 }} />
        {keyLabel}
        {renderPrimitive(value, highlight)}
        {!lastInParent && <span style={{ color: COLORS.punct }}>,</span>}
      </div>
    );
  }

  const entries = isArr
    ? (value as any[]).map((v, i) => [i, v] as [number, any])
    : Object.entries(value as Record<string, any>);
  const count = entries.length;
  const openBracket = isArr ? '[' : '{';
  const closeBracket = isArr ? ']' : '}';

  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <div
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            color: COLORS.toggle,
            display: 'inline-block',
            width: 12,
            textAlign: 'center',
          }}
        >
          {open ? '▼' : '▶'}
        </span>
        {keyLabel}
        <span style={{ color: COLORS.punct }}>{openBracket}</span>
        {!open && (
          <>
            <span style={{ color: COLORS.meta }}>
              {' '}
              {isArr ? `Array(${count})` : `${count} ${count === 1 ? 'key' : 'keys'}`}{' '}
            </span>
            <span style={{ color: COLORS.punct }}>{closeBracket}</span>
            {!lastInParent && <span style={{ color: COLORS.punct }}>,</span>}
          </>
        )}
      </div>

      {open && (
        <>
          {entries.map(([k, v], i) => (
            <Node
              key={String(k)}
              name={k as any}
              value={v}
              depth={depth + 1}
              defaultExpanded={defaultExpanded}
              lastInParent={i === entries.length - 1}
              highlight={highlight}
            />
          ))}
          <div style={{ paddingLeft: 0 }}>
            <span style={{ display: 'inline-block', width: 12 }} />
            <span style={{ color: COLORS.punct }}>{closeBracket}</span>
            {!lastInParent && <span style={{ color: COLORS.punct }}>,</span>}
          </div>
        </>
      )}
    </div>
  );
}

function renderPrimitive(v: any, highlight?: string) {
  if (v === null) return <span style={{ color: COLORS.null }}>null</span>;
  if (v === undefined) return <span style={{ color: COLORS.null }}>undefined</span>;
  if (typeof v === 'string')
    return (
      <span style={{ color: COLORS.string }}>
        &quot;{highlightText(v, highlight)}&quot;
      </span>
    );
  if (typeof v === 'number')
    return <span style={{ color: COLORS.number }}>{highlightText(String(v), highlight)}</span>;
  if (typeof v === 'boolean')
    return <span style={{ color: COLORS.boolean }}>{String(v)}</span>;
  return <span>{String(v)}</span>;
}
