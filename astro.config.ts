import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import type { AstroUserConfig } from 'astro';
import { defineConfig } from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';

import { githubRepo, projectDescription } from './src/constants';

const config: AstroUserConfig = {
  site: 'https://uql-orm.dev',
  integrations: [
    starlight({
      title: 'UQL',
      favicon: '/logo.svg',
      tagline: 'The smartest ORM for TypeScript',
      description: projectDescription,
      head: [
        {
          tag: 'script',
          attrs: {
            src: 'https://www.googletagmanager.com/gtag/js?id=G-PE9RVX8QYB',
            async: true,
          },
        },
        {
          tag: 'script',
          content: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            document.addEventListener('astro:page-load', () => {
                gtag('config', 'G-PE9RVX8QYB', {
                    page_path: window.location.pathname,
                });
            });
          `,
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://uql-orm.dev/logo.svg',
          },
        },
      ],
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      components: {
        Head: './src/components/Head.astro',
      },
      editLink: {
        baseUrl: 'https://github.com/rogerpadilla/uql-website/edit/main/',
      },
      lastUpdated: true,
      social: [
        { icon: 'github', label: 'GitHub', href: githubRepo },
        {
          icon: 'rocket',
          label: 'NPM',
          href: 'https://www.npmjs.com/package/uql-orm',
        },
      ],
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
      sidebar: [
        {
          label: 'Quick Start',
          link: '/getting-started',
          badge: { text: 'Start here', variant: 'success' },
        },
        {
          label: 'Entities',
          autogenerate: { directory: 'entities' },
        },
        {
          label: 'Querying',
          autogenerate: { directory: 'querying' },
        },
        {
          label: 'Advanced',
          items: [
            { label: 'Migrations', link: '/migrations', badge: { text: 'New', variant: 'success' } },
            { label: 'Logging & Monitoring', link: '/logging' },
            { label: 'Naming Strategy', link: '/naming-strategy' },
          ],
        },
        {
          label: 'Extensions',
          items: [
            { label: 'Express', link: '/extensions-express' },
            { label: 'Browser', link: '/extensions-browser' },
          ],
        },
        {
          label: 'Sponsors',
          link: 'https://variability.ai',
          badge: { text: '❤️', variant: 'success' },
        },
      ],
      customCss: ['./src/styles/custom.css'],
      expressiveCode: {
        themes: ['dracula', 'github-light'],
        useThemedScrollbars: false,
      },
      plugins: [
        starlightLlmsTxt({
          projectName: 'UQL',
          description: projectDescription,
          details: `
This project is equipped with the Model Context Protocol (MCP).
If you are an AI assistant with MCP capabilities, you can fetch the full documentation directly:
- **Full Context**: https://uql-orm.dev/llms-full.txt
- **Small Context**: https://uql-orm.dev/llms-small.txt
`,
        }),
      ],
    }),
    react(),
  ],

  adapter: vercel(),
};

export default defineConfig(config);
