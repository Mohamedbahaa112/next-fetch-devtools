import { getLogs, clearLogs } from './logger';

export type RouteHandlers = {
  GET: () => Response;
  DELETE: () => Response;
};

function json(body: unknown, status = 200) {
  let text: string;
  try {
    text = JSON.stringify(body);
  } catch (e: any) {
    text = JSON.stringify({ error: 'serialization failed: ' + (e?.message || e), logs: [] });
    status = 500;
  }
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createDevtoolsRoute(options: { enabled?: boolean } = {}): RouteHandlers {
  const enabled = options.enabled ?? process.env.NODE_ENV !== 'production';

  return {
    GET: () => {
      if (!enabled) return json({ disabled: true }, 404);
      try {
        return json({ logs: getLogs() });
      } catch (e: any) {
        return json({ error: e?.message || String(e), logs: [] }, 500);
      }
    },
    DELETE: () => {
      if (!enabled) return json({ disabled: true }, 404);
      try {
        clearLogs();
        return json({ ok: true });
      } catch (e: any) {
        return json({ error: e?.message || String(e) }, 500);
      }
    },
  };
}
