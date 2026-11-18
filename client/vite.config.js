import { reportUrl } from './src/utils/report-url.mjs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  if (command === 'build' && mode !== 'local-demo') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
    reportUrl('configuration-check', env.VITE_PUBLIC_FRONTEND_URL, '', true);
    const api = env.VITE_API_URL || '/api';
    if (api !== '/api') {
      let url;
      try { url = new URL(api); } catch { /* Checked below. */ }
      if (!url || url.pathname !== '/api' || url.username || url.password || url.search || url.hash)
        throw new Error('Set VITE_API_URL to /api or the public HTTPS API URL ending in /api.');
      try { reportUrl('configuration-check', url.origin, '', true); }
      catch { throw new Error('VITE_API_URL must use the public HTTPS API origin.'); }
    }
  }
  return {
    plugins: [react()],
    server: { port: 5173 },
  };
});
