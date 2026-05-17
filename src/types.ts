export type LoggedFetch = {
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
