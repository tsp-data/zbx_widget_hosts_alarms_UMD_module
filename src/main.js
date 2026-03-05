import { createApp } from 'vue';
import App from './App.vue';

createApp(App, {
  context: {  //provided by Zabbix, contains info about widget id and refresh rate
    widgetid: '12345',
    rf_rate: 10, // Refresh rate in seconds
  },
  conf: {
    apiurl: 'http://rhel10zbx7.mshome.net/zabbix/api_jsonrpc.php',
    apikey: '18d34d41de32ac6874c3936efba35ee259dbaf424deb33de316dd7760e4536b5',
    hostgroup: 'test',
  },
}).mount('#app');
