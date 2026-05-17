// Server-only auto-setup: installs fetch logger and monkey-patches axios prototype.
import { installFetchLogger, attachAxiosLogger } from './server/logger';

installFetchLogger();

function patchAxios() {
  try {
    let axios: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      axios = require('axios');
      if (axios && axios.default) axios = axios.default;
    } catch {}
    if (!axios || axios.__nfdPatched) return;
    axios.__nfdPatched = true;

    // 1. Patch axios.create so new instances get logged
    const originalCreate = axios.create.bind(axios);
    axios.create = function (...args: any[]) {
      const instance = originalCreate(...args);
      try {
        return attachAxiosLogger(instance);
      } catch {
        return instance;
      }
    };

    // 2. Attach to the default axios instance (catches axios.get(), etc.)
    try {
      attachAxiosLogger(axios);
    } catch {}

    // 3. Patch the Axios prototype so ALREADY-created instances are also logged.
    // We use a request interceptor on the prototype, since all instances share the prototype's methods.
    try {
      const Axios = axios.Axios;
      if (Axios && Axios.prototype && !Axios.prototype.__nfdPatched) {
        Axios.prototype.__nfdPatched = true;
        const origRequest = Axios.prototype.request;
        Axios.prototype.request = function (configOrUrl: any, maybeConfig?: any) {
          try {
            // Only attach once per instance
            if (!this.__nfdAttached) {
              attachAxiosLogger(this);
            }
          } catch {}
          return origRequest.call(this, configOrUrl, maybeConfig);
        };
      }
    } catch {}
  } catch {}
}

patchAxios();
