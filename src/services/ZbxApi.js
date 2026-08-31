/**
 * Default API endpoint for the token transport.
 *
 * Relative, so it resolves against the Zabbix frontend the dashboard is served
 * from (`/zabbix/api_jsonrpc.php` for a default installation). That keeps the
 * request same-origin and needs no CORS configuration.
 */
export const DEFAULT_API_URL = 'api_jsonrpc.php'

/**
 * Error type for Zabbix API and transport failures.
 */
export class ZbxApiError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: number, data?: unknown, httpStatus?: number }} [opts]
   */
  constructor(message, opts) {
    super(message)
    this.name = 'ZbxApiError'
    this.code = opts?.code
    this.data = opts?.data
    this.httpStatus = opts?.httpStatus
  }
}

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
  return typeof v === 'object' && v !== null
}

/*
 * A transport is how one JSON-RPC call reaches Zabbix: an async
 * `(method, params, { signal }) => result` that resolves with the JSON-RPC result
 * and rejects with a ZbxApiError. Two implementations exist because the two
 * supported access modes have different trust models (see "Access modes" in
 * README.md):
 *
 * - tokenTransport: api_jsonrpc.php with an API token from the widget
 *   configuration. The widget acts as the token's user - one shared identity
 *   for everyone who sees the dashboard.
 * - hostTransport: the wrapper's zbx.api host function (js_wrapper 1.1+), which
 *   goes through a session-authenticated gate. The widget acts as the
 *   logged-in user, with their own permissions.
 *
 * Both fail with identically shaped errors, so everything above a transport is
 * mode-agnostic.
 */

/**
 * Direct JSON-RPC transport authenticated by an API token.
 *
 * @param {string} apiUrl Full JSON-RPC endpoint URL, including api_jsonrpc.php
 * @param {string} apiToken
 * @returns {(method: string, params: object|unknown[], opts?: { signal?: AbortSignal }) => Promise<unknown>}
 */
export function tokenTransport(apiUrl, apiToken) {
  if (!apiUrl || apiUrl.trim() === '') {
    throw new ZbxApiError('tokenTransport: apiUrl is required')
  }
  if (!apiToken || apiToken.trim() === '') {
    throw new ZbxApiError(
      'Not configured: set "apikey" in the widget conf JSON, or run under a ' +
        'js_wrapper that offers zbx.api (see "api" in README.md).',
    )
  }

  return async (method, params, opts) => {
    const req = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    }

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(req),
      signal: opts?.signal,
    })

    if (!res.ok) {
      throw new ZbxApiError(`HTTP error ${res.status}`, { httpStatus: res.status })
    }

    /** @type {unknown} */
    const payload = await res.json()

    if (!isRecord(payload)) {
      throw new ZbxApiError('Invalid JSON-RPC response (not an object)')
    }

    if (payload.error) {
      // `data` carries the actionable part ("Session terminated, re-login,
      // please." for a bad token, the offending parameter name, ...), while
      // `message` is often just "Invalid params.", so include both.
      const detail = payload.error.data ? ` ${payload.error.data}` : ''
      throw new ZbxApiError(
        `Zabbix API error ${payload.error.code}: ${payload.error.message}${detail}`,
        { code: payload.error.code, data: payload.error.data },
      )
    }

    if (!('result' in payload)) {
      throw new ZbxApiError('Zabbix API response missing "result"')
    }

    return payload.result
  }
}

/**
 * Transport over the wrapper's session-authenticated host API (`payload.zbx.api`).
 *
 * The wrapper already produces errors in the api_jsonrpc.php shape (message ready
 * to display, `code`/`data` attached), so this only rewraps them as ZbxApiError.
 *
 * @param {(method: string, params?: unknown, opts?: { signal?: AbortSignal }) => Promise<unknown>} zbxApi
 * @returns {(method: string, params: object|unknown[], opts?: { signal?: AbortSignal }) => Promise<unknown>}
 */
export function hostTransport(zbxApi) {
  return async (method, params, opts) => {
    try {
      return await zbxApi(method, params, opts)
    } catch (e) {
      if (e instanceof ZbxApiError || e?.name === 'AbortError') throw e
      throw new ZbxApiError(e?.message ? e.message : String(e), {
        code: e?.code,
        data: e?.data,
        httpStatus: e?.httpStatus,
      })
    }
  }
}

/**
 * Pick the transport for the current configuration and wrapper payload.
 *
 * `conf.api` decides:
 *
 * - `"auto"` (default): the session gate when the wrapper offers one, the token
 *   otherwise. Local development (`npm run dev`) has no wrapper, so it lands on
 *   the token via the Vite proxy with no configuration change.
 * - `"session"`: the gate only; an older wrapper is reported instead of silently
 *   falling back to a shared token the deployment wanted to avoid.
 * - `"token"`: the token only, even when a gate is available - for widgets that
 *   must act as one shared service identity (see README.md).
 *
 * @param {object} conf Effective widget configuration
 * @param {object} zbx `payload.zbx` from the wrapper, or anything falsy
 * @returns {(method: string, params: object|unknown[], opts?: { signal?: AbortSignal }) => Promise<unknown>}
 */
export function makeTransport(conf, zbx) {
  const mode = conf?.api ?? 'auto'
  const hostApi = typeof zbx?.api === 'function' ? zbx.api : null

  if (mode !== 'token' && hostApi) {
    return hostTransport(hostApi)
  }

  if (mode === 'session') {
    throw new ZbxApiError(
      '"api" is set to "session", but this wrapper offers no zbx.api - js_wrapper 1.1 or newer is required.',
    )
  }

  return tokenTransport(conf?.apiurl || DEFAULT_API_URL, conf?.apikey)
}

/**
 * Lightweight Zabbix API client over a transport.
 */
export class ZbxApiClient {
  /**
   * @param {(method: string, params: object|unknown[], opts?: { signal?: AbortSignal }) => Promise<unknown>} transport
   * @param {{ timeoutMs?: number }} [opts]
   */
  constructor(transport, opts) {
    this.transport = transport
    this.timeoutMs = opts?.timeoutMs ?? 8000
  }

  /**
   * Generic call with the client's timeout applied, whatever the transport.
   * @template T
   * @param {string} method
   * @param {Record<string, unknown> | unknown[]} [params]
   * @returns {Promise<T>}
   */
  async call(method, params = {}) {
    const ac = new AbortController()
    const t = window.setTimeout(() => ac.abort(), this.timeoutMs)

    try {
      return /** @type {T} */ (await this.transport(method, params, { signal: ac.signal }))
    } catch (e) {
      if (e instanceof ZbxApiError) throw e
      if (e?.name === 'AbortError') {
        throw new ZbxApiError(`Zabbix API request timed out (${method})`)
      }
      throw new ZbxApiError(e?.message ? e.message : String(e))
    } finally {
      window.clearTimeout(t)
    }
  }
}
