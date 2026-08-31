import { createApp } from 'vue';
import App from './App.vue';

createApp(App, {
  context: {  //provided by Zabbix, contains info about widget id and refresh rate
    widgetid: '12345',
    rf_rate: 10, // Refresh rate in seconds
  },
  conf: {
    // '/zbx-api' is proxied by the Vite dev server to ZBX_URL (see vite.config.js):
    //   ZBX_URL=http://192.168.2.10/zabbix npm run dev
    // The proxy keeps the browser request same-origin - the Zabbix API sends no
    // CORS headers, so a direct cross-origin call from localhost is blocked.
    //
    // Do not commit a real token here. There is no wrapper in dev mode, so the
    // session transport ("api": "session") is not available - "auto" falls back
    // to the token by itself.
    apiurl: '/zbx-api',
    apikey: '<ZABBIX_API_TOKEN>',
    hostgroup: 'test',
  },
}).mount('#app');
