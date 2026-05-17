#!/usr/bin/env node
/* eslint-disable */
try {
  main();
} catch (e) {
  console.log('[next-fetch-devtools] postinstall skipped:', e && e.message);
  process.exit(0);
}

function main() {
  const fs = require('fs');
  const path = require('path');

  if (process.env.INIT_CWD === undefined) return;
  if (process.env.NEXT_FETCH_DEVTOOLS_SKIP_POSTINSTALL === '1') return;

  const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
  const green = (s) => `\x1b[32m${s}\x1b[0m`;
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  const gray = (s) => `\x1b[90m${s}\x1b[0m`;

  const projectRoot = process.env.INIT_CWD;
  if (!projectRoot) return;

  const isNextJs =
    fs.existsSync(path.join(projectRoot, 'next.config.js')) ||
    fs.existsSync(path.join(projectRoot, 'next.config.ts')) ||
    fs.existsSync(path.join(projectRoot, 'next.config.mjs')) ||
    fs.existsSync(path.join(projectRoot, 'app')) ||
    fs.existsSync(path.join(projectRoot, 'src/app'));

  if (!isNextJs) {
    console.log(gray('[next-fetch-devtools] Not a Next.js project, skipping.'));
    return;
  }

  const appDir = fs.existsSync(path.join(projectRoot, 'src/app'))
    ? path.join(projectRoot, 'src/app')
    : path.join(projectRoot, 'app');

  // 1. Create supporting files
  const files = [
    {
      path: path.join(appDir, 'api', '__devtools', 'fetches', 'route.ts'),
      content: `import { createDevtoolsRoute } from 'next-fetch-devtools/server';

const handlers = createDevtoolsRoute();
export const GET = handlers.GET;
export const DELETE = handlers.DELETE;
export const dynamic = 'force-dynamic';
`,
    },
    {
      path: path.join(appDir, '__devtools', 'page.tsx'),
      content: `import { notFound } from 'next/navigation';
import { DevtoolsStandalone } from 'next-fetch-devtools/client';

export const dynamic = 'force-dynamic';

export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DevtoolsStandalone />;
}
`,
    },
    {
      path: path.join(projectRoot, 'src/lib/devtools-setup.ts'),
      content: `import { installFetchLogger } from 'next-fetch-devtools/server';

installFetchLogger();
`,
    },
  ];

  let created = 0;
  let skipped = 0;
  for (const f of files) {
    if (fs.existsSync(f.path)) {
      skipped++;
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(f.path), { recursive: true });
      fs.writeFileSync(f.path, f.content);
      created++;
    } catch (e) {
      console.log(yellow(`[next-fetch-devtools] Could not create ${f.path}: ${e.message}`));
    }
  }

  // 2. Try to inject <Devtools /> into root layout
  const layoutCandidates = [
    path.join(appDir, 'layout.tsx'),
    path.join(appDir, 'layout.jsx'),
    path.join(appDir, 'layout.ts'),
    path.join(appDir, 'layout.js'),
  ];
  let layoutFile = null;
  for (const c of layoutCandidates) {
    if (fs.existsSync(c)) {
      layoutFile = c;
      break;
    }
  }

  let layoutInjected = false;
  let layoutAlready = false;

  if (layoutFile) {
    try {
      let src = fs.readFileSync(layoutFile, 'utf8');
      if (src.includes('next-fetch-devtools')) {
        layoutAlready = true;
      } else {
        // Find last import line and insert ours after it
        const importRegex = /^import .+ from .+;?$/gm;
        let lastMatch;
        let m;
        while ((m = importRegex.exec(src)) !== null) lastMatch = m;
        const importLine =
          "import { Devtools } from 'next-fetch-devtools/client';\nimport 'next-fetch-devtools/auto-server';";
        if (lastMatch) {
          const insertAt = lastMatch.index + lastMatch[0].length;
          src = src.slice(0, insertAt) + '\n' + importLine + src.slice(insertAt);
        } else {
          src = importLine + '\n' + src;
        }

        // Inject <Devtools /> before </body>
        if (src.includes('</body>')) {
          src = src.replace(
            /(\s*)<\/body>/,
            `$1  <Devtools />\n$1</body>`,
          );
          fs.writeFileSync(layoutFile, src);
          layoutInjected = true;
        }
      }
    } catch (e) {
      console.log(yellow(`[next-fetch-devtools] Could not modify layout: ${e.message}`));
    }
  }

  console.log('');
  console.log(cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(green('✓ next-fetch-devtools setup complete'));
  console.log('');
  console.log(`  Created ${created} file(s), skipped ${skipped} (already existed).`);
  if (layoutInjected) {
    console.log(green('  ✓ Added <Devtools /> to ' + path.relative(projectRoot, layoutFile)));
  } else if (layoutAlready) {
    console.log(gray('  • Layout already imports next-fetch-devtools, left unchanged.'));
  } else {
    console.log(yellow('  ⚠ Could not auto-modify your layout. Add manually:'));
    console.log('');
    console.log(gray("    import { Devtools } from 'next-fetch-devtools/client';"));
    console.log(gray('    // inside <body>:'));
    console.log(gray('    <Devtools />'));
  }
  console.log('');
  console.log(gray("If you use axios, wrap your instance with attachAxiosLogger() — see README."));
  console.log(cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log('');
}
