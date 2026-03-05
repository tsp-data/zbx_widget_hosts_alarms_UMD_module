# BUILD and Development (`hosts_alarms`)

This document explains how to run the module in local development mode, build UMD artifacts, and deploy them for use with the Zabbix `js_wrapper` module.

## Project Origin

The base project skeleton was created following the official Vue Quick Start approach:

- https://vuejs.org/guide/quick-start

## 1. Prerequisites

- Node.js version compatible with `package.json` engines (`^20.19.0 || >=22.12.0`)
- npm

## 2. Install Dependencies

```sh
cd zbx_widget_hosts_alarms_UMD_module
npm install
```

## 3. Local Development (outside Zabbix)

During development you can run the widget as a standalone Vue app, without Zabbix:

```sh
npm run dev
```

Benefits:

- fast frontend iteration with Vite hot reload,
- ability to inspect component state and tree via Vue DevTools,
- easy simulation of widget resizing via the local resizable host container in `index.html`.

In this mode, the app is served by Vite and rendered through `src/main.js`.

Local development screenshot:

![Local development preview](images/zabbix_local_dev.png)

## 4. Build UMD Library for Zabbix Wrapper

To build deployable UMD artifacts used by `js_wrapper`:

```sh
npm run build:lib
```

Build configuration is in `vite.lib.config.js`.

Expected outputs:

- `dist/hosts_alarms.umd.js`
- `dist/hosts_alarms.css`

Note: Vue and ECharts are bundled directly into the UMD file (not externalized).

## 5. Deploy Artifacts to `js_wrapper`

Copy built files into Zabbix wrapper assets:

```sh
cp dist/hosts_alarms.umd.js ../js_wrapper/assets/umd/hosts_alarms.umd.js
cp dist/hosts_alarms.css ../js_wrapper/assets/umd/hosts_alarms.css
```

Then in Zabbix widget configuration set:

- `component`: `hosts_alarms`
- `conf_json`: valid JSON (must include `apiurl`, `apikey`, and `hostgroup` for this module)

Example `conf_json`:

```json
{
    "apiurl": "https://zabbix.example.com/zabbix/api_jsonrpc.php",
    "apikey": "18d34d41de32ac6874c3936efba35ee259dbaf424deb33de316dd7760e4536b5",
    "hostgroup": "test"
}
```

Zabbix dashboard result screenshot:

![Zabbix dashboard widget result](images/zabbix_dashboard.png)

## 6. Optional Commands

Lint and formatting helpers:

```sh
npm run lint
npm run format
```

## 7. Troubleshooting

- If the widget does not load in Zabbix, verify both files exist in `js_wrapper/assets/umd/`.
- If global API is not found, check that `src/entry.js` publishes `window.hosts_alarms`.
- If UI renders in local dev but not in Zabbix, re-check wrapper `component` value and artifact file names.
- If no data is shown, verify `conf_json` values and API token permissions.

