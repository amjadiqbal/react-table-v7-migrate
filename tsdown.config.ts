import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    compat: 'src/compat.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node20',
  dts: true,
  clean: true,
  fixedExtension: false,
  deps: { neverBundle: ['react', '@tanstack/react-table', 'recast', '@babel/parser', 'tinyglobby'] },
})
