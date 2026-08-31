import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    proxy: {
      // Escape hatch for local development against a real Zabbix.
      //
      // The Zabbix API sends no CORS headers, so the dev server has to proxy it
      // for the browser request to stay same-origin. Point conf.apiurl at
      // '/zbx-api' and start the dev server with the frontend base URL, e.g.
      //   ZBX_URL=http://192.168.2.10/zabbix npm run dev
      '/zbx-api': {
        target: process.env.ZBX_URL || 'http://localhost/zabbix',
        changeOrigin: true,
        rewrite: () => '/api_jsonrpc.php',
      },
    },
  },
})
