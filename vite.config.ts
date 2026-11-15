import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { securityHeaders } from './config/securityHeaders';
import { horizonsPlugin } from './server/horizons';
import { landingPlugin } from './server/landingApi';
import { monthlyPlugin } from './server/monthlyEphemeris';
import { surfaceLayerPlugin } from './server/surfaceLayerApi';

export default defineConfig({
  plugins: [react(), monthlyPlugin(), horizonsPlugin(), landingPlugin(), surfaceLayerPlugin()],
  assetsInclude: ['**/*.stl'],
  server: { port: 5173, strictPort: true, headers: securityHeaders(true) },
  preview: { headers: securityHeaders() },
});
