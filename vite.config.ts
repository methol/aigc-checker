import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-exifr': ['exifr'],
          'vendor-musicmeta': ['music-metadata-browser'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist', 'mediainfo.js'],
  },
  worker: {
    format: 'es',
  },
})
