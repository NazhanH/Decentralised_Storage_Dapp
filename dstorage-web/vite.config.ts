import { defineConfig, PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import {nodePolyfills} from 'vite-plugin-node-polyfills'
import tailwindcss from '@tailwindcss/vite'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    nodePolyfills() as PluginOption,
    tailwindcss(),
  ],
  resolve: {
    alias: {
      events: 'events',
      "@": path.resolve(__dirname, "./src"),
    }
  },
  optimizeDeps: {
    include: ['events']
  }
})
