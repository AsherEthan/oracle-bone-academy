import { readFile, mkdir, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const root = resolve(process.argv[2] ?? '.')
const dir = `${root}/research/sinica-unlisted-headwords-20261031`
await mkdir(dir, { recursive: true })
const indexed = JSON.parse(await readFile(`${root}/research/sinica-corpus-20261031/headwords.json`, 'utf8'))
const known = new Set(indexed.map(item => item.order))
const max = Math.max(...[...known].filter(n => n < 3000))
const origin = 'https://xiaoxue.iis.sinica.edu.tw'
const records = [], absent = []
const exists = path => access(path).then(() => true, () => false)
async function request(url, options = {}) {
  await new Promise(resolve => setTimeout(resolve, 1500))
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(45000) })
  if (!r.ok) throw new Error(`Stopped on HTTP ${r.status}`)
  return r
}
for (let order = 1; order <= max; order++) {
  if (known.has(order)) continue
  const folder = `${dir}/head-${order}`
  await mkdir(folder, { recursive: true })
  const recordFile = `${folder}/record.json`
  if (await exists(recordFile)) { records.push(JSON.parse(await readFile(recordFile, 'utf8'))); continue }
  const queryFolder = `${folder}/query`; await mkdir(queryFolder, { recursive: true })
  const queryFile = `${queryFolder}/source.html`
  const query = await exists(queryFile) ? await readFile(queryFile, 'utf8') : await (await request(`${origin}/jiaguwen/PageResult/PageResult`, { method: 'POST', body: new URLSearchParams({ ZiOrder: String(order), PaginalZiNum: '5', ImageSize: '36' }) })).text()
  if (!await exists(queryFile)) await writeFile(queryFile, query, { flag: 'wx' })
  const count = query.match(/共搜尋到(\d+)字/)
  if (!count) throw new Error(`Invalid query response ${order}`)
  if (Number(count[1]) === 0) { absent.push(order); continue }
  if (!query.includes(`id="StartOrder">${order}</span>`)) throw new Error(`Headword redirected: ${order}`)
  const code = query.match(/alt="&(4[1-9]\.[A-F0-9]+);"/i)?.[1]
  if (!code) throw new Error(`No actual oracle example for ${order}`)
  const pageFolder = `${folder}/page`; await mkdir(pageFolder, { recursive: true })
  const pageFile = `${pageFolder}/source.html`
  const html = await exists(pageFile) ? await readFile(pageFile, 'utf8') : await (await request(`${origin}/char?fontcode=${code}`)).text()
  if (!await exists(pageFile)) await writeFile(pageFile, html, { flag: 'wx' })
  const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]).find(t => t.includes(`alt="&${code};"`))
  const src = tag?.match(/\bsrc="([^"]+)"/)?.[1]
  const reference = html.match(/<span id="Reference">([\s\S]*?)<\/span>/)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!src || !reference) throw new Error(`Missing source attributes for ${order}`)
  const url = new URL(src, origin); url.searchParams.set('size', '200')
  if (url.origin !== origin) throw new Error('Unexpected image host')
  const imageFolder = `${folder}/image`; await mkdir(imageFolder, { recursive: true })
  const imageFile = `${imageFolder}/source.png`
  const image = await exists(imageFile) ? await readFile(imageFile) : Buffer.from(await (await request(url.href)).arrayBuffer())
  if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error(`Not PNG: ${order}`)
  if (!await exists(imageFile)) await writeFile(imageFile, image, { flag: 'wx' })
  const record = { order, code, catalogueUrl: `${origin}/jiaguwen?ZiOrder=${order}`, labels: [...html.matchAll(/alt="&0\.([0-9a-f]+);"/gi)].map(m => String.fromCodePoint(parseInt(m[1], 16))), reference, originalUrl: url.href, sourceRecordUrl: `${origin}/char?fontcode=${code}`, sha256: createHash('sha256').update(image).digest('hex'), checkedAt: '2026-10-31', folder: `head-${order}` }
  records.push(record)
  await writeFile(recordFile, JSON.stringify(record, null, 2), { flag: 'wx' })
  console.log(`Additional native headword ${order}, ${code}`)
}
await writeFile(`${dir}/manifest.json`, JSON.stringify({ records, absent, range: [1, max], checkedAt: '2026-10-31' }, null, 2))
console.log(`Supplement complete: ${records.length} actual entries; ${absent.length} empty source queries, not published.`)
