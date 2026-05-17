// One-line auto-setup: just import this once anywhere in your app.
//
//   import 'next-fetch-devtools/auto';
//
// - Server: installs fetch logger automatically (NODE_ENV=development only)
// - Client: mounts the DevtoolsPanel into <body> automatically

import { installFetchLogger } from './server/logger';

installFetchLogger();

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const ID = '__nfd_devtools_root__';

  const mount = async () => {
    if (document.getElementById(ID)) return;
    try {
      const [{ createRoot }, React, { default: DevtoolsPanel }] = await Promise.all([
        import('react-dom/client'),
        import('react'),
        import('./client/DevtoolsPanel'),
      ]);

      const apiBase =
        (typeof process !== 'undefined' &&
          process.env &&
          (process.env.NEXT_PUBLIC_API_BASE_URL as string)) ||
        '';

      const container = document.createElement('div');
      container.id = ID;
      document.body.appendChild(container);
      createRoot(container).render(
        React.createElement(DevtoolsPanel as any, { apiBase }),
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[next-fetch-devtools] auto-mount failed:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}
