import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';
import type { AstroUserConfig } from 'astro';
import { defineConfig, envField } from 'astro/config';
import mermaid from 'astro-mermaid';
import starlightBlog from 'starlight-blog';
import starlightLlmsTxt from 'starlight-llms-txt';

import { projectDescription } from './src/constants';

const config: AstroUserConfig = {
  site: 'https://uql-orm.dev',
  // Normalize away trailing slashes so the PostHog /ingest proxy rewrites match
  // capture paths like /ingest/i/v0/e/ (otherwise they fall through to the 404 route).
  trailingSlash: 'never',
  integrations: [
    mermaid({ theme: 'forest', autoTheme: true, enableLog: false }),
    starlight({
      title: 'UQL',
      favicon: '/logo.svg',
      tagline: 'The Smartest TypeScript ORM',
      description: projectDescription,
      head: [
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
              label: 'Switching to UQL',
              link: '/switching-to-uql',
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
            {
              label: 'AI & RAG',
              link: '/ai-semantic-search',
              badge: { text: 'New', variant: 'success' },
            },
          ],
        },
        {
          label: 'Entities',
          items: [
            { label: 'Decorators', link: '/entities/basic' },
            { label: 'Imperative API', link: '/entities/imperative' },
            { label: 'Virtual Fields', link: '/entities/virtual-fields' },
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
            { label: 'Multi-tenancy & RLS', link: '/multi-tenancy' },
            { label: 'Migrations', link: '/migrations' },
            { label: 'Logging & Monitoring', link: '/logging' },
            { label: 'Naming Strategy', link: '/naming-strategy' },
          ],
        },
        {
          label: 'Ecosystem',
          items: [
            { label: 'Express', link: '/extensions-express' },
            { label: 'Fastify', link: '/fastify', badge: { text: 'New', variant: 'success' } },
            { label: 'NestJS', link: '/nestjs' },
            { label: 'Next.js', link: '/nextjs' },
            { label: 'TanStack Start', link: '/tanstack-start', badge: { text: 'New', variant: 'success' } },
            {
              label: 'HTTP (any framework)',
              link: '/extensions-http',
              badge: { text: 'New', variant: 'success' },
            },
            { label: 'Hono', link: '/hono', badge: { text: 'New', variant: 'success' } },
            { label: 'Elysia', link: '/elysia', badge: { text: 'New', variant: 'success' } },
            { label: 'tRPC', link: '/trpc' },
            { label: 'oRPC', link: '/orpc', badge: { text: 'New', variant: 'success' } },
            { label: 'Browser', link: '/extensions-browser' },
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

  env: {
    schema: {
      // PostHog project key is public by design (safe to expose client-side).
      // Required so a missing var fails the build loudly instead of silently disabling analytics.
      PUBLIC_POSTHOG_KEY: envField.string({ context: 'client', access: 'public' }),
      // Same-origin proxy path (see /ingest rewrites in vercel.json).
      PUBLIC_POSTHOG_HOST: envField.string({ context: 'client', access: 'public', default: '/ingest' }),
    },
  },

  adapter: vercel(),
};

export default defineConfig(config);
