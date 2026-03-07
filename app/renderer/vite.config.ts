import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname),

  base: './', // 🔥 IMPORTANTE para que Electron cargue assets correctamente

  plugins: [react()],

  build: {
    outDir: path.resolve(__dirname, '../../dist/renderer'),
    emptyOutDir: true,
  },
});