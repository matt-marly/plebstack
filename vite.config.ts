import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // The ecash libraries are most of the weight and change least often, so they get their own chunk.
        manualChunks: id => (/node_modules\/@(cashu|noble|scure)\//.test(id) ? 'cashu' : undefined),
      },
    },
  },
});
