import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Shell scripts are included via package.json "files" field, not bundled.
  // Do NOT use noExternal blanket -- let tsup handle bundling of small deps.
});
