import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { versionedIconsPlugin } from '../../versionedIconsPlugin.js';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), 'public');
const icons = versionedIconsPlugin(publicDir);
const icon = icons.icon;

export default defineConfig({
  plugins: [
    react(),
    icons,
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false,
      includeAssets: [
        'favicon-32.png',
        'apple-touch-icon.png',
        'logo.png',
        'logo.webp',
        'logo-1024.png',
      ],
      manifest: {
        name: 'kabakaba Vendeur',
        short_name: 'kabakaba V',
        description: 'Espace vendeur kabakaba',
        theme_color: '#F07840',
        background_color: '#F07840',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          { src: icon('pwa-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: icon('pwa-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: icon('pwa-512-maskable.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'kabakaba-images',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5174,
    host: true,
  },
});
