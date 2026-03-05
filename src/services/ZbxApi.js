/**
 * Error type for Zabbix API and transport failures.
 */
export class ZbxApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: number, data?: unknown, httpStatus?: number }} [opts]
   */
  constructor(message, opts) {
    super(message);
    this.name = 'ZbxApiError';
    this.code = opts?.code;
    this.data = opts?.data;
    this.httpStatus = opts?.httpStatus;
  }
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
  return typeof v === 'object' && v !== null;
}

/**
 * Lightweight JSON-RPC client for Zabbix API.
 */
export class ZbxApiClient {
  /**
   * @param {string} apiUrl Full JSON-RPC endpoint URL, including api_jsonrpc.php
   * @param {string} apiToken
   */
  constructor(apiUrl, apiToken) {
    if (!apiUrl || apiUrl.trim() === '') {
      throw new ZbxApiError('ZbxApiClient: apiUrl is required');
    }
    if (!apiToken || apiToken.trim() === '') {
      throw new ZbxApiError('ZbxApiClient: apiToken is required');
    }

    this.endpoint = apiUrl;
    this.apiToken = apiToken;
    this.timeoutMs = 8000;
  }

  /**
   * Generic JSON-RPC call.
   * @template T
   * @param {string} method
   * @param {Record<string, unknown> | unknown[]} [params]
   * @param {{ auth?: boolean }} [opts]
   * @returns {Promise<T>}
   */
  async call(method, params = {}, opts) {
    const useAuth = opts?.auth !== false;

    const req = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    };

    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), this.timeoutMs);

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (useAuth) {
        headers.Authorization = `Bearer ${this.apiToken}`;
      }

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(req),
        signal: ac.signal,
      });

      if (!res.ok) {
        throw new ZbxApiError(`HTTP error ${res.status}`, {
          httpStatus: res.status,
        });
      }

      /** @type {unknown} */
      const payload = await res.json();

      if (!isRecord(payload)) {
        throw new ZbxApiError('Invalid JSON-RPC response (not an object)');
      }

      const rpc = payload;

      if (rpc.error) {
        throw new ZbxApiError(`Zabbix API error ${rpc.error.code}: ${rpc.error.message}`, {
          code: rpc.error.code,
          data: rpc.error.data,
        });
      }

      if (!('result' in rpc)) {
        throw new ZbxApiError('Zabbix API response missing "result"');
      }

      return /** @type {T} */ (rpc.result);
    } finally {
      window.clearTimeout(t);
    }
  }

  /**
   * Convenience method for Zabbix API version.
   * @returns {Promise<string>}
   */
  async version() {
    return this.call('apiinfo.version', {}, { auth: false });
  }
}
