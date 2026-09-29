# Hosts Alarms UMD Module (for Zabbix JS Wrapper)

This directory contains a frontend widget module in UMD format, intended to be hosted by the `js_wrapper` plugin for Zabbix.

The module renders an overview of hosts and their active problems as an ECharts heatmap (tile = host, color = highest severity).

For build, local development, and deployment steps, see `BUILD.md`.

## What the Module Does

- loads hosts from the selected host group,
- loads active problems and maps them to hosts,
- renders a responsive heatmap,
- shows tooltip details for alarms,
- opens Zabbix Problem view for a host on click.

## Technology

- Vue 3
- Vite
- ECharts
- JSON-RPC calls to Zabbix API (via `fetch`)

## UMD Host API (Wrapper Contract)

The library build publishes API under:

- `componentName = "hosts_alarms"`
- global export: `window.hosts_alarms`

API shape:

```js
window.hosts_alarms = {
  mount(el, payload) {
    return {
      destroy() {
        // unmount + cleanup
      },
      update(nextPayload) {
        // refresh without remount
      },
    };
  },
};
```

`payload` from wrapper:

- `payload.conf`: parsed JSON from `conf_json`
- `payload.context`: runtime metadata (for example `widgetid`, `rf_rate`)
- `payload.zbx`: the wrapper's host API - `capabilities`, and `api(method, params)` used
  by the session access mode (see "Access Modes" below)

## Access Modes

The widget reaches the Zabbix API one of two ways, selected by the `api` key:

- `"auto"` (default): the wrapper's session-authenticated gate (`zbx.api`, js_wrapper 1.1+)
  when offered, the token otherwise. **Session mode acts as the logged-in user** - each
  viewer sees exactly the hosts and problems their own permissions allow, and no secret
  sits in the widget configuration.
- `"session"`: the gate only; an older wrapper is reported as an error.
- `"token"`: the token only - one shared identity for everyone who sees the dashboard
  (a NOC wallboard). The token is readable by every dashboard viewer, so scope it.

The trust-model comparison and the module integration pattern live in "Host API" of the
`js_wrapper` README. All four API calls this widget makes are reads, covered by the
gate's default allowlist.

## Configuration (`conf_json`)

| Key         | Default           | Description                                                              |
| ----------- | ----------------- | ------------------------------------------------------------------------ |
| `api`       | `auto`            | Access mode: `auto` \| `session` \| `token` - see above                  |
| `apikey`    | -                 | Zabbix API token. Required for the token mode; ignored by the session mode |
| `apiurl`    | `api_jsonrpc.php` | JSON-RPC endpoint of the token mode; the relative default resolves against the frontend |
| `hostgroup` | all               | Optional scope: a host group name or numeric id. Without it, every host the current identity may read is shown - under the session mode that is the user's own scope |

Example (session mode - the whole configuration):

```json
{
  "api": "session",
  "hostgroup": "Linux servers"
}
```

Example (token mode):

```json
{
  "apikey": "<ZABBIX_API_TOKEN>",
  "hostgroup": "Linux servers"
}
```

A configured group that does not exist (or that the current identity may not see) is
reported as an error rather than rendered as an empty heatmap.

## Data Loading Flow

`Helper.getLiveAlarms(hostgroup)` calls the API in this order:

1. `hostgroup.get` - resolve a host group name to `groupid` (skipped for a numeric id,
   or with no `hostgroup` at all)
2. `host.get` - load the hosts in scope
3. `problem.get` - load active problems for the same scope
4. `event.get(selectHosts)` - map events to hosts

The resulting data shape:

```js
[
  {
    hostid: "12345",
    hostname: "db-prod-01",
    alarms: [{ severity: 4, message: "Disk space is low" }],
  },
];
```

## Project Structure

- `src/entry.js` - registers `window.hosts_alarms` + `mount/destroy/update`
- `src/App.vue` - ECharts heatmap rendering + interactions
- `src/services/Helper.js` - data transformation, layout utilities, API workflow
- `src/services/ZbxApi.js` - the two transports (token / session gate), their selection
  (`makeTransport`), and a lightweight Zabbix API client over them
- `vite.lib.config.js` - UMD library build configuration

## Important Notes

- Reading hosts and problems requires the corresponding permissions: the logged-in
  user's own in the session mode, the token user's in the token mode.
- `src/main.js` is a demo file; do not commit real production tokens. Local development
  has no wrapper, so it always runs in the token mode (through the Vite `/zbx-api` proxy).
- `update(payload)` supports refresh without remount and triggers re-rendering on
  configuration changes.
- `vite.lib.config.js` replaces `process.env.NODE_ENV` at build time. This is required,
  not an optimisation: `js_wrapper` 1.1 ships no process shim, so a build without the
  top-level `define` fails in Zabbix with `ReferenceError: process is not defined`.

## License

MIT - see `LICENSE`. Copyright (c) 2026 TSP Data a.s.
