import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    emptyOutDir: false, // do not clear output dir - used by other builds
    lib: {
      entry: 'src/entry.js',
      name: 'ZbxVueWidget', // Global name for UMD/IIFE wrapper
      formats: ['umd'], // or ['iife']
      fileName: () => 'hosts_alarms.umd.js', // Output file name
      cssFileName: 'hosts_alarms', // Output CSS file name (hosts_alarms.css)
    },
    rollupOptions: {
      // Do not externalize anything -> Vue, axios, echarts bundled inside
      external: [],
      output: {
        // Ensure it behaves as a library
        inlineDynamicImports: true,
      },
    },
  },
});
