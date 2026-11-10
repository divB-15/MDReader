import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The desktop host embeds the built page as a single HTML resource, so the
// whole frontend (JS, CSS, KaTeX fonts) must end up in one file.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: {
    target: 'chrome110',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 8000,
  },
})
