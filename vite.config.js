import { defineConfig } from 'vite'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Every .html file in the project root is its own page.
const pages = Object.fromEntries(
  readdirSync(import.meta.dirname)
    .filter((f) => f.endsWith('.html'))
    .map((f) => [f.replace(/\.html$/, ''), resolve(import.meta.dirname, f)]),
)

export default defineConfig({
  // GitHub Pages serves this repo at https://jj-nilbodee.github.io/trickster/
  base: '/trickster/',
  build: { rollupOptions: { input: pages } },
})
