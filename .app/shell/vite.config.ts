import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// 5573 = port unique ต่อแอป — ดู .shared/ports.md
// ห้ามใช้ port เดียวกับแอปอื่น (wait-on จะ grab ของชาวบ้าน)
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared/ui': path.resolve(__dirname, 'src/shared-ui'),
    },
  },
  server: {
    port: 5573,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
