import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import express from 'express';
import { initDb } from './server/db.js';
import { setupApiRoutes } from './server/api.js';

function apiPlugin() {
  return {
    name: 'api-server',
    async configureServer(server) {
      await initDb();
      const app = express();
      app.use(express.json());
      setupApiRoutes(app);
      server.middlewares.use(app);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), apiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173
  }
});
