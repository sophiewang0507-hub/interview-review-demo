import { defineConfig } from 'vite'

// 开发期把 /api 代理到本地后端，避免跨域，并且不会把 OpenAI Key 暴露到浏览器
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})

