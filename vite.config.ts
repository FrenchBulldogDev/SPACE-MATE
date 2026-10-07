import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityHeaders } from './config/securityHeaders';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.stl'],
  server: { port: 5173, strictPort: true, headers: securityHeaders(true) },
  preview: { headers: securityHeaders() },
});
