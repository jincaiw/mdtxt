import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({
  base: '/',
  trailingSlash: 'ignore',
  devToolbar: {
    enabled: false,
  },
  integrations: [icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});
