import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

// Async cleanup avoids a Node 24/Windows crash in synchronous directory removal.
const root = fileURLToPath(new URL('../', import.meta.url))
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true })
await build({ root, build: { emptyOutDir: false } })
