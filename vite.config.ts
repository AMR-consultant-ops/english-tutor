import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Use './' so it works on any GitHub repository name automatically
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
