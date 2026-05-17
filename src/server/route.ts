import { getLogs, clearLogs } from './logger';

export type RouteHandlers = {
  GET: () => Response;
  DELETE: () => Response;
};

export function createDevtoolsRoute(options: { enabled?: boolean } = {}): RouteHandlers {
  const enabled = options.enabled ?? process.env.NODE_ENV !== 'production';

  return {
    GET: () => {
      if (!enabled) return new Response('Not found', { status: 404 });
      return new Response(JSON.stringify({ logs: getLogs() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
    DELETE: () => {
      if (!enabled) return new Response('Not found', { status: 404 });
      clearLogs();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}
