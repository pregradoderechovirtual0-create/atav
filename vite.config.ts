import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined

  if (id.includes('/@firebase/auth') || id.includes('/firebase/auth')) {
    return 'vendor-firebase-auth'
  }

  if (id.includes('/@firebase/firestore') || id.includes('/firebase/firestore')) {
    return 'vendor-firebase-firestore'
  }

  if (id.includes('/firebase/') || id.includes('/@firebase/')) {
    return 'vendor-firebase'
  }

  if (id.includes('/xlsx/')) {
    return 'vendor-xlsx'
  }

  if (
    id.includes('/vue/') ||
    id.includes('/vue-router/') ||
    id.includes('/@vue/')
  ) {
    return 'vendor-vue'
  }

  return undefined
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunk(id)
        },
      },
    },
  },
})
