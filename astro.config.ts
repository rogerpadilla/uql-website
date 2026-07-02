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
    mermaid(),
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
              label: 'FAQ',
              link: '/faq',
            },
            {
              label: 'AI & Semantic Search',
              link: '/ai-semantic-search',
            },
            {
              label: 'Comparison',
              link: '/comparison',
            },
            {
              label: 'Benchmark',
              link: '/comparison#performance',
            },
          ],
        },
        {
          label: 'Core',
          items: [
            { label: 'Entities', link: '/entities/basic' },
            { label: 'Relations', link: '/entities/relations' },
            { label: 'Soft Delete', link: '/entities/soft-delete' },
            { label: 'Lifecycle Hooks', link: '/entities/lifecycle-hooks' },
            { label: 'Inheritance', link: '/entities/inheritance' },
            { label: 'Indexes', link: '/entities/indexes' },
            { label: 'Imperative API', link: '/entities/imperative' },
          ],
        },
        {
          label: 'Querying',
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
            { label: 'Next.js', link: '/nextjs' },
            { label: 'Bun Native SQL', link: '/bun-sql' },
            { label: 'Cloudflare Workers & D1', link: '/cloudflare-d1' },
            { label: 'Express', link: '/extensions-express' },
            { label: 'Browser', link: '/extensions-browser' },
          ],
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
