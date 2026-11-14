import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The worktree's root .env carries FRONTEND_PORT, VITE_API_BASE_URL, VITE_USE_MOCK.
// The port itself is passed by the root `dev:frontend` script (--port $FRONTEND_PORT).
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
