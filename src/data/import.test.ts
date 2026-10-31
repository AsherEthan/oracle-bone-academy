import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const importer = fileURLToPath(new URL('../../scripts/import-sinica-corpus.mjs', import.meta.url))

describe('native-range publication gate', () => {
  for (const complete of [false, true]) {
    it(`rejects ${complete ? 'incomplete coverage marked complete' : 'an in-progress acquisition'} without changing the public corpus`, () => {
      const folder = mkdtempSync(join(tmpdir(), 'zizai-incomplete-range-'))
      const corpusFile = new URL('./corpus.json', import.meta.url)
      const before = readFileSync(corpusFile)
      try {
        writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ complete, range: [3001, 5952], candidateCount: 0, records: [], absent: [] }))
        const result = spawnSync(process.execPath, [importer, root, join(root, 'research/sinica-corpus-20261031'), folder], { encoding: 'utf8' })
        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain(complete ? 'Incomplete or duplicated native range query coverage' : 'Native range acquisition is incomplete')
        expect(readFileSync(corpusFile).equals(before)).toBe(true)
      } finally {
        rmSync(folder, { recursive: true, force: true })
      }
    })
  }
})
