import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import {nodePolyfills} from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    nodePolyfills() as PluginOption,
  ],
  resolve: {
    alias: {
      events: 'events'
    }
  },
  optimizeDeps: {
    include: ['events']
  }
})
