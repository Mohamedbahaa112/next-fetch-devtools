import { defineConfig } from 'tsup';

const shared = {
  format: ['cjs', 'esm'] as ('cjs' | 'esm')[],
  dts: true,
  clean: false,
  splitting: false,
  sourcemap: true,
  external: ['react', 'react-dom', 'next', 'axios'],
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
    },
    ...shared,
  },
]);
