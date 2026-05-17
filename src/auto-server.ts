// Server-only auto-setup: installs fetch logger and monkey-patches axios.create.
import { installFetchLogger, attachAxiosLogger } from './server/logger';

installFetchLogger();

// Auto-patch axios.create so any instance the user creates gets logging.
(async () => {
  try {
    // Use dynamic import so axios is optional
    // @ts-ignore - axios is an optional peer dep
    const mod: any = await import('axios').catch(() => null);
    if (!mod) return;
    const axios = mod.default || mod;
    if (axios.__nfdPatched) return;
    axios.__nfdPatched = true;

    const originalCreate = axios.create.bind(axios);
    axios.create = function (...args: any[]) {
      const instance = originalCreate(...args);
      try {
        return attachAxiosLogger(instance);
      } catch {
        return instance;
      }
    };
    // Also attach to the default axios instance
    try {
      attachAxiosLogger(axios);
    } catch {}
  } catch {}
})();
