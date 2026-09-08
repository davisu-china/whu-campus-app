import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 本地开发：/api 代理到本地后端；连线上后端时改为 https://bbs.jianjiange.site
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
