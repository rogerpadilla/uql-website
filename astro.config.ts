import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import type { AstroUserConfig } from 'astro';
import { defineConfig } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlightBlog from 'starlight-blog';
import starlightLlmsTxt from 'starlight-llms-txt';

import { projectDescription } from './src/constants';

const config: AstroUserConfig = {
  site: 'https://uql-orm.dev',
  integrations: [
    mermaid({ theme: 'forest', autoTheme: true }),
    starlight({
      title: 'UQL',
      favicon: '/logo.svg',
      tagline: 'The Smartest TypeScript ORM',
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
             gtag('config', 'G-PE9RVX8QYB');
           `,
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://uql-orm.dev/og-image.png',
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:alt',
            content: 'UQL, the Smartest TypeScript ORM',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: 'https://uql-orm.dev/og-image.png',
          },
        },
      ],
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      components: {
        Head: './src/components/Head.astro',
        Hero: './src/components/Hero.astro',
        SocialIcons: './src/components/SocialIcons.astro',
      },
      editLink: {
        baseUrl: 'https://github.com/rogerpadilla/uql-website/edit/main/',
      },
      lastUpdated: true,
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },
      sidebar: [
        {
          label: 'Overview',
          items: [
            { label: 'Welcome', link: '/' },
            {
              label: 'Quick Start',
              link: '/getting-started',
            },
            {
              label: 'AI & RAG',
              link: '/ai-semantic-search',
              badge: { text: 'New', variant: 'success' },
            },
            {
              label: 'Comparison',
              link: '/comparison',
            },
            {
              label: 'Benchmark',
              link: '/benchmark',
            },
          ],
        },
        {
          label: 'Entities',
          items: [
            { label: 'Decorators', link: '/entities/basic' },
            { label: 'Imperative API', link: '/entities/imperative' },
            { label: 'Relations', link: '/entities/relations' },
            { label: 'Soft Delete', link: '/entities/soft-delete' },
            { label: 'Lifecycle Hooks', link: '/entities/lifecycle-hooks' },
            { label: 'Inheritance', link: '/entities/inheritance' },
            { label: 'Indexes', link: '/entities/indexes' },
          ],
        },
        {
          label: 'Queries',
          items: [{ autogenerate: { directory: 'querying' } }],
        },
        {
          label: 'Advanced',
          items: [
            { label: 'Migrations', link: '/migrations' },
            { label: 'Logging & Monitoring', link: '/logging' },
            { label: 'Naming Strategy', link: '/naming-strategy' },
          ],
        },
        {
          label: 'Ecosystem',
          items: [
            {
              label: 'HTTP (any framework)',
              link: '/extensions-http',
              badge: { text: 'New', variant: 'success' },
            },
            { label: 'Express', link: '/extensions-express' },
            { label: 'Browser', link: '/extensions-browser' },
            { label: 'Next.js', link: '/nextjs' },
            { label: 'NestJS', link: '/nestjs' },
            { label: 'tRPC', link: '/trpc' },
            { label: 'oRPC', link: '/orpc', badge: { text: 'New', variant: 'success' } },
            { label: 'React Query', link: '/react-query' },
            { label: 'Bun Native SQL', link: '/bun-sql' },
            { label: 'Cloudflare Workers & D1', link: '/cloudflare-d1' },
          ],
        },
        {
          label: 'FAQ',
          link: '/faq',
        },
        {
          label: 'Blog',
          link: '/blog',
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
        starlightBlog({
          title: 'Blog',
          authors: {
            rogerpadilla: {
              name: 'Roger Padilla',
              url: 'https://github.com/rogerpadilla',
            },
          },
        }),
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
  ],

  adapter: vercel(),
};

export default defineConfig(config);
