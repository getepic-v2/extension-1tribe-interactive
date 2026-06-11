import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const manifest = JSON.parse(readFileSync('./manifest.json', 'utf-8')) as {
  globalName: string
}

const globalName = manifest.globalName

export default defineConfig({
  assetsInclude: ['**/*.riv'],
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __EXTENSION_GLOBAL_NAME__: JSON.stringify(globalName),
  },
  plugins: [
    {
      name: 'one-tribe-copy-extension-manifest',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'manifest.json',
          source: JSON.stringify(manifest, null, 2),
        })
      },
    },
  ],
  build: {
    lib: {
      entry: 'src/extension/index.ts',
      name: globalName,
      formats: ['iife'],
      fileName: () => `${globalName}-main.js`,
    },
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    emptyOutDir: true,
    outDir: 'dist-extension',
  },
})
