import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const manifest = JSON.parse(readFileSync('./manifest.json', 'utf-8').replace(/^\uFEFF/, '')) as {
  entry: string
  globalName: string
}

const entryFile = manifest.entry
const globalName = manifest.globalName

export default defineConfig({
  assetsInclude: ['**/*.riv'],
  publicDir: false,
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __EXTENSION_ENTRY_FILE__: JSON.stringify(entryFile),
    __EXTENSION_GLOBAL_NAME__: JSON.stringify(globalName),
  },
  plugins: [
    {
      name: '1tribe-copy-extension-manifest',
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
      fileName: () => entryFile,
    },
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    emptyOutDir: true,
    outDir: 'dist-extension',
  },
})
