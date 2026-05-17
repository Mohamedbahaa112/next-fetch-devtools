#!/usr/bin/env node
/* eslint-disable */
try {
  main();
} catch (e) {
  // Never fail the install if our auto-setup hits an error
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

function findProjectRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (dir.endsWith('node_modules')) {
      dir = path.dirname(dir);
      continue;
    }
    const pkg = path.join(dir, 'package.json');
    if (fs.existsSync(pkg) && !dir.includes(`${path.sep}node_modules${path.sep}`)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const projectRoot = process.env.INIT_CWD || findProjectRoot(__dirname);
if (!projectRoot || projectRoot === __dirname) process.exit(0);

const isNextJs =
  fs.existsSync(path.join(projectRoot, 'next.config.js')) ||
  fs.existsSync(path.join(projectRoot, 'next.config.ts')) ||
  fs.existsSync(path.join(projectRoot, 'next.config.mjs')) ||
  fs.existsSync(path.join(projectRoot, 'app')) ||
  fs.existsSync(path.join(projectRoot, 'src/app'));

if (!isNextJs) {
  console.log(gray('[next-fetch-devtools] Not a Next.js project, skipping auto-setup.'));
  process.exit(0);
}

const appDir = fs.existsSync(path.join(projectRoot, 'src/app'))
  ? path.join(projectRoot, 'src/app')
  : path.join(projectRoot, 'app');

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

console.log('');
console.log(cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log(green('✓ next-fetch-devtools auto-setup complete'));
console.log('');
console.log(`  Created ${created} file(s), skipped ${skipped} (already existed).`);
console.log('');
console.log(cyan('One more step') + ' — add this to your root layout:');
console.log('');
console.log(gray("  import '@/lib/devtools-setup';"));
console.log(gray("  import { DevtoolsPanel } from 'next-fetch-devtools/client';"));
console.log('');
console.log(gray('  // inside <body>:'));
console.log(gray('  {process.env.NODE_ENV === "development" && ('));
console.log(gray('    <DevtoolsPanel apiBase={process.env.NEXT_PUBLIC_API_BASE_URL} />'));
console.log(gray('  )}'));
console.log('');
console.log(gray('And if you use axios, wrap your instance:'));
console.log('');
console.log(gray("  import { attachAxiosLogger } from 'next-fetch-devtools/server';"));
console.log(gray("  export const client = attachAxiosLogger(axios.create({...}));"));
console.log(cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
console.log('');
}
