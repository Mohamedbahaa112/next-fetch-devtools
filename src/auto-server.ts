// Server-only auto-setup: installs fetch logger and monkey-patches axios.create.
// MUST be imported BEFORE anything else (top of root layout).
import { installFetchLogger, attachAxiosLogger } from './server/logger';

installFetchLogger();

// Synchronously patch axios so it's done before any user code calls axios.create()
function patchAxios() {
  try {
    let axios: any = null;
    try {
      // CJS / bundler-friendly resolution
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      axios = require('axios');
      if (axios && axios.default) axios = axios.default;
    } catch {
      try {
        // ESM dynamic import fallback (loaded via top-level createRequire)
        // @ts-ignore
        const mod = require('axios');
        axios = mod.default || mod;
      } catch {}
    }
    if (!axios || axios.__nfdPatched) return;
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
    try {
      attachAxiosLogger(axios);
    } catch {}
  } catch {}
}

patchAxios();
