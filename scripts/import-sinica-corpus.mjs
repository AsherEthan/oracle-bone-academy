import { readFile, mkdir, copyFile, writeFile, access, constants } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const input = resolve(process.argv[3] ?? `${root}/research/sinica-corpus-20261031`)
const origin = 'https://xiaoxue.iis.sinica.edu.tw'
const manifest = JSON.parse(await readFile(`${input}/manifest.json`, 'utf8'))
const directory = JSON.parse(await readFile(`${input}/headwords.json`, 'utf8'))
if (manifest.total !== directory.length || manifest.records.length !== directory.length) throw new Error('Incomplete acquisition; refusing to publish a partial corpus')
const supplementalRoot = `${root}/research/sinica-unlisted-headwords-20261031`
const supplemental = JSON.parse(await readFile(`${supplementalRoot}/manifest.json`, 'utf8'))
const rangeRoot = process.argv[4] ? resolve(process.argv[4]) : undefined
const nativeRange = rangeRoot ? JSON.parse(await readFile(`${rangeRoot}/manifest.json`, 'utf8')) : undefined
if (nativeRange) {
  if (!nativeRange.complete || !Array.isArray(nativeRange.range) || nativeRange.range[0] !== 3001 || nativeRange.range[1] !== 5952) throw new Error('Native range acquisition is incomplete or its scope changed')
  const known = new Set([...directory, ...supplemental.records].map(record => record.order))
  const expected = new Set(Array.from({ length: nativeRange.range[1] - nativeRange.range[0] + 1 }, (_, index) => index + nativeRange.range[0]).filter(order => !known.has(order)))
  const checked = [...nativeRange.records.map(record => record.order), ...nativeRange.absent]
  if (nativeRange.candidateCount !== expected.size || checked.length !== expected.size || new Set(checked).size !== checked.length || checked.some(order => !expected.has(order))) throw new Error('Incomplete or duplicated native range query coverage')
  if (nativeRange.records.some(record => record.folder !== `head-${record.order}`)) throw new Error('Unexpected native range evidence folder')
  for (const order of nativeRange.absent) {
    const html = await readFile(`${rangeRoot}/head-${order}/query/source.html`, 'utf8')
    if (!/共搜尋到0字/.test(html)) throw new Error(`Missing empty-query evidence ${order}`)
  }
}
const indexed = new Map(directory.map(item => [item.code, item]))
const groups = new Map()
const codes = new Map()
const allRecords = [
  ...manifest.records.map(record => ({ ...record, researchFolder: `${input}/glyph-${record.code.toLowerCase().replace('.', '-')}`, supplemental: false })),
  ...supplemental.records.map(record => ({ ...record, researchFolder: `${supplementalRoot}/${record.folder}`, supplemental: true })),
  ...(nativeRange?.records ?? []).map(record => ({ ...record, researchFolder: `${rangeRoot}/${record.folder}`, supplemental: true })),
]
const imageAssets = []
const decode = text => text.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ').trim()

for (const record of allRecords) {
  if (!/^4[1-9]\.[A-F0-9]+$/.test(record.code) || (!record.supplemental && indexed.get(record.code)?.order !== record.order)) throw new Error(`Invalid directory association ${record.code}`)
  if (codes.has(record.code) && codes.get(record.code) !== record.sha256) throw new Error(`Conflicting source bytes ${record.code}`)
  codes.set(record.code, record.sha256)
  if (record.supplemental) {
    const query = await readFile(`${record.researchFolder}/query/source.html`, 'utf8')
    if (!query.includes(`id="StartOrder">${record.order}</span>`) || !query.includes(`alt="&${record.code};"`)) throw new Error(`Invalid supplemental headword ${record.order}`)
  }
  const folder = `glyph-${record.code.toLowerCase().replace('.', '-')}`
  const html = await readFile(`${record.researchFolder}/page/source.html`, 'utf8')
  const image = await readFile(`${record.researchFolder}/image/source.png`)
  const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]).find(tag => tag.includes(`alt="&${record.code};"`))
  const src = tag?.match(/\bsrc="([^"]+)"/)?.[1]
  if (!src) throw new Error(`Missing source glyph ${record.code}`)
  const imageUrl = new URL(decode(src), origin)
  imageUrl.searchParams.set('size', '200')
  if (imageUrl.origin !== origin || imageUrl.href !== record.originalUrl) throw new Error(`Image identity changed: ${record.code}`)
  const normalizeReference = value => decode(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const reference = normalizeReference(html.match(/<span id="Reference">([\s\S]*?)<\/span>/)?.[1] ?? '')
  if (!reference || normalizeReference(record.reference) !== reference) throw new Error(`Reference mismatch ${record.code}`)
  const labels = [...new Set([...html.matchAll(/alt="&0\.([0-9a-f]+);"/gi)].map(m => String.fromCodePoint(parseInt(m[1], 16))))]
    .filter(label => /^\p{Script=Han}$/u.test(label))
  if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || createHash('sha256').update(image).digest('hex') !== record.sha256) throw new Error(`PNG integrity failure ${record.code}`)
  const group = groups.get(record.order) ?? { order: record.order, labels: [], examples: [] }
  group.labels = [...new Set([...group.labels, ...labels])]
  group.examples.push({ code: record.code, reference, originalUrl: record.originalUrl, sha256: record.sha256 })
  groups.set(record.order, group)
  imageAssets.push({ folder, from: `${record.researchFolder}/image/source.png`, sha256: record.sha256 })
}
if (new Set(manifest.records.map(record => record.order)).size !== manifest.headwordCount) throw new Error('Native headword count mismatch')
const assetRoot = `${root}/public/glyph-sources/sinica-corpus-20261031`
await mkdir(assetRoot, { recursive: true })
for (const asset of imageAssets) {
  const dir = `${assetRoot}/${asset.folder}`
  const path = `${dir}/image.png`
  await mkdir(dir, { recursive: true })
  if (await access(path).then(() => true, () => false)) {
    const existing = await readFile(path)
    if (createHash('sha256').update(existing).digest('hex') !== asset.sha256) throw new Error(`Refusing to overwrite changed asset: ${path}`)
  } else await copyFile(asset.from, path, constants.COPYFILE_EXCL)
}
const output = `${root}/src/data/corpus.json`
const previous = JSON.parse(await readFile(output, 'utf8'))
if (!Array.isArray(previous.records)) throw new Error('Unexpected output format; refusing to replace')
if (previous.nativeRangeRows && !nativeRange) throw new Error('Refusing to drop previously imported native range records; pass the range directory as the fourth argument')
const corpus = { catalogueRows: manifest.total, supplementalRows: supplemental.records.length, nativeRangeRows: nativeRange?.records.length ?? 0, nativeRangeCoverage: nativeRange ? { range: nativeRange.range, queried: nativeRange.candidateCount, emptyQueries: nativeRange.absent.length, complete: true } : undefined, headwordCount: groups.size, checkedAt: manifest.checkedAt, records: [...groups.values()].sort((a, b) => a.order - b.order) }
await writeFile(output, JSON.stringify(corpus))
console.log(`Imported ${corpus.headwordCount} native headword groups, ${codes.size} distinct source-backed forms (${corpus.catalogueRows} directory rows, ${corpus.supplementalRows} ordinary supplements, ${corpus.nativeRangeRows} range additions). Curated examples are merged by native headword ID in the application.`)
