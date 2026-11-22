import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // @scure/base puts a pure annotation where Rollup can't read it; Rollup drops the comment and nothing else changes.
      onwarn(warning, warn) {
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('/node_modules/@scure/base/')) return;
        warn(warning);
      },
      output: {
        // The ecash libraries are most of the weight and change least often, so they get their own chunk.
        manualChunks: id => (/node_modules\/@(cashu|noble|scure)\//.test(id) ? 'cashu' : undefined),
      },
    },
  },
});
