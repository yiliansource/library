// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import { siteConfig } from './src/site.config';

// https://astro.build/config
export default defineConfig({
  site: siteConfig.url,
  adapter: cloudflare({
    imageService: "passthrough"
  }),

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});