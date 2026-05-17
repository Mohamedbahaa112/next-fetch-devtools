// Server-only auto-setup: installs fetch logger and monkey-patches axios.
import { installFetchLogger, attachAxiosLogger } from './server/logger';

installFetchLogger();

function patchAxiosInstance(axios: any, label: string) {
  if (!axios) {
    console.log(`[nfd] axios ${label}: not found`);
    return;
  }
  if (axios.__nfdPatched) return;
  axios.__nfdPatched = true;

  const originalCreate = axios.create?.bind(axios);
  if (originalCreate) {
    axios.create = function (...args: any[]) {
      const instance = originalCreate(...args);
      try {
        return attachAxiosLogger(instance);
      } catch {
        return instance;
      }
    };
  }
  try {
    attachAxiosLogger(axios);
  } catch {}

  try {
    const Axios = axios.Axios;
    if (Axios?.prototype && !Axios.prototype.__nfdPatched) {
      Axios.prototype.__nfdPatched = true;
      const origRequest = Axios.prototype.request;
      Axios.prototype.request = function (configOrUrl: any, maybeConfig?: any) {
        try {
          if (!this.__nfdAttached) attachAxiosLogger(this);
        } catch {}
        return origRequest.call(this, configOrUrl, maybeConfig);
      };
    }
  } catch {}
  console.log(`[nfd] axios ${label}: patched ✓`);
}

// Sync require (CJS-style)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cjsAxios = require('axios');
  patchAxiosInstance(cjsAxios?.default || cjsAxios, 'cjs');
} catch (e: any) {
  console.log('[nfd] axios cjs require failed:', e?.message);
}

// Async ESM import (catches ESM-only resolution)
(async () => {
  try {
    // @ts-ignore
    const mod: any = await import('axios');
    patchAxiosInstance(mod?.default || mod, 'esm');
  } catch (e: any) {
    console.log('[nfd] axios esm import failed:', e?.message);
  }
})();
