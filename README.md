# next-fetch-devtools

In-browser network devtools for Next.js apps. Captures **server-side** and **client-side** `fetch` and `axios` requests and shows them in a floating, resizable panel — like Chrome DevTools' Network tab, but for server components too.

![Devtools panel](https://placehold.co/800x400?text=next-fetch-devtools)

## Features

- Captures all `fetch` calls (server + client)
- Captures all `axios` calls (attach an interceptor to any instance)
- Floating panel with drag, resize from any edge, minimize, maximize
- Tabs: Mine (your API) / External / All
- Filters by method (GET/POST/...) and failed-only
- JSON tree viewer (expand/collapse arrays and objects)
- Open in a separate browser tab (full page)
- Dev-only by default — disabled in production

## Install

```bash
npm install next-fetch-devtools
```

## Setup (Next.js App Router)

### 1. Patch `fetch` and `axios` on the server

Create `lib/devtools-setup.ts`:

```ts
import { installFetchLogger } from 'next-fetch-devtools/server';

installFetchLogger();
```

Import it once in your `app/layout.tsx`:

```tsx
import 'lib/devtools-setup';
```

If you use axios, wrap your instance:

```ts
import axios from 'axios';
import { attachAxiosLogger } from 'next-fetch-devtools/server';

export const client = attachAxiosLogger(
  axios.create({ baseURL: process.env.NEXT_PUBLIC_API_BASE_URL }),
);
```

### 2. Add the API route

Create `app/api/__devtools/fetches/route.ts`:

```ts
import { createDevtoolsRoute } from 'next-fetch-devtools/server';

const handlers = createDevtoolsRoute();
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
export const dynamic = 'force-dynamic';
```

### 3. Render the panel in your root layout

```tsx
import { DevtoolsPanel } from 'next-fetch-devtools/client';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <DevtoolsPanel apiBase={process.env.NEXT_PUBLIC_API_BASE_URL} />
        )}
      </body>
    </html>
  );
}
```

### 4. (Optional) Standalone full-page route

Create `app/__devtools/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { DevtoolsStandalone } from 'next-fetch-devtools/client';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DevtoolsStandalone />;
}
```

## API

### `installFetchLogger(options?)`

Monkey-patches `globalThis.fetch`. Call once on server startup.

```ts
installFetchLogger({
  enabled: process.env.NODE_ENV === 'development', // default
  ignoreUrlPatterns: ['/api/__devtools', /metrics/],
});
```

### `attachAxiosLogger(instance, options?)`

Attaches request/response interceptors to an axios instance.

### `createDevtoolsRoute(options?)`

Returns `{ GET, DELETE }` handlers for the logs API.

### `<DevtoolsPanel />` props

| prop | default | description |
|---|---|---|
| `apiBase` | `''` | Base URL of YOUR API — used by the "Mine" tab |
| `endpoint` | `/api/__devtools/fetches` | API route that returns the logs |
| `standaloneUrl` | `/__devtools` | URL of the standalone full-page devtools |

## Production safety

All loggers and routes are **disabled** by default when `NODE_ENV === 'production'`. You can override with the `enabled` option if you want it elsewhere.

## License

MIT
