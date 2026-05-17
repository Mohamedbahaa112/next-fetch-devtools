import { defineConfig } from 'tsup';
import pkg from './package.json';

const shared = {
  format: ['cjs', 'esm'] as ('cjs' | 'esm')[],
  dts: true,
  clean: false,
  splitting: false,
  sourcemap: true,
  external: ['react', 'react-dom', 'next', 'axios'],
  define: {
    __NFD_VERSION__: JSON.stringify(pkg.version),
  },
};

export default defineConfig([
  {
    entry: { 'client/index': 'src/client/index.ts' },
    banner: { js: '"use client";' },
    ...shared,
    clean: true,
  },
  {
    entry: {
      index: 'src/index.ts',
      'server/index': 'src/server/index.ts',
      auto: 'src/auto.ts',
      'auto-server': 'src/auto-server.ts',
    },
    ...shared,
  },
]);
