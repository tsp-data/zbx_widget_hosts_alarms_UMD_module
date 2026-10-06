# Changelog

All notable changes to this module are listed here. The prebuilt files of every version are
attached to the matching
[GitHub release](https://github.com/tsp-data/zbx_widget_hosts_alarms_UMD_module/releases).

## [0.1.0] - 2026-10-06

First release. Assets: `hosts_alarms.umd.js`, `hosts_alarms.css`, `hosts_alarms-0.1.0.zip`,
`SHA256SUMS.txt`.

### Added

- Overview of hosts and their active problems as an ECharts heatmap in a Zabbix dashboard widget
  hosted by `js_wrapper`: one tile per host, coloured by the highest problem severity.
- Tooltip with the problems of a host; a click opens the Zabbix Problems view for that host.
- Two access modes to the Zabbix API: the wrapper's session gate (`zbx.api`, acts as the
  logged-in user, needs js_wrapper 1.1 or newer) and an API token in `conf_json`. The `api` key
  selects `auto`, `session` or `token`.
- Optional `hostgroup` scope by name or id; a group that does not exist or is not visible to the
  current identity is reported as an error instead of an empty heatmap.
- Standalone development harness (`npm run dev`) with a resizable host container and a Vite proxy
  to a Zabbix API (token mode).

### Build

- Built with `npm ci && npm run build:lib` (Node.js 24.19.0, Vite 7.3.6). `process.env.NODE_ENV`
  is inlined, so the module needs no shim from the wrapper.
- License MIT; bundled third-party libraries: Vue (MIT), Apache ECharts (Apache-2.0) with ZRender
  (BSD-3-Clause) and tslib (0BSD).

[0.1.0]: https://github.com/tsp-data/zbx_widget_hosts_alarms_UMD_module/releases/tag/v0.1.0
