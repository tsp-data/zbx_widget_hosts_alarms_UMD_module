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
- `payload.zbx`: reserved host API object

## Configuration (`conf_json`)

The module currently expects these keys in `payload.conf`:

- `apiurl` - URL to `api_jsonrpc.php`
- `apikey` - Zabbix API token (Bearer)
- `hostgroup` - host group name used for loading hosts/problems

Example:

```json
{
  "apiurl": "https://zabbix.example.com/zabbix/api_jsonrpc.php",
  "apikey": "<ZABBIX_API_TOKEN>",
  "hostgroup": "Linux servers"
}
```

## Data Loading Flow

`Helper.getLiveAlarms(hostgroup)` calls the API in this order:

1. `hostgroup.get` - resolve host group name to `groupid`
2. `host.get` - load hosts in that group
3. `problem.get` - load active problems for the group
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
- `src/services/ZbxApi.js` - lightweight Zabbix JSON-RPC client
- `vite.lib.config.js` - UMD library build configuration

## Important Notes

- The module requires a valid Zabbix API token with permission to read hosts/problems.
- `src/main.js` is a demo file; do not commit real production tokens.
- `update(payload)` supports refresh without remount and triggers re-rendering on configuration changes.
