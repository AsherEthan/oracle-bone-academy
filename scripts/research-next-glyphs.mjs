import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as pause } from 'node:timers/promises'

if (!process.argv[2]) throw new Error('Pass a new research directory')
const root = resolve(process.argv[2])
await mkdir(root)
const candidates = [
  ['火', '43.E513', '前6.49.3 合17067'],
  ['雨', '43.EA46', '佚55'],
  ['人', '42.F47D', '甲2940 合18901'],
  ['子', '44.E079', '乙6702'],
  ['目', '41.F455', '鐵16.1 合11654'],
  ['口', '41.E513', '甲1193'],
  ['牛', '41.E431', '乙6964 合9525'],
  ['鱼', '43.EAFC', '前4.56.1 合10492'],
]
const headers = { 'User-Agent': 'ZiZai-educational-source-review/1.0' }
const records = []
for (const [char, code, record] of candidates) {
  await pause(800)
  const entryDirectory = resolve(root, `u${char.codePointAt(0).toString(16)}`)
  await mkdir(entryDirectory)
  const pageDirectory = resolve(entryDirectory, 'page')
  await mkdir(pageDirectory)
  const sourceRecordUrl = `https://xiaoxue.iis.sinica.edu.tw/char?fontcode=${code}`
  const page = await fetch(sourceRecordUrl, { headers, signal: AbortSignal.timeout(30000) })
  if (!page.ok) throw new Error(`${char} catalogue: HTTP ${page.status}; stopping, no fallback`)
  const html = await page.text()
  await writeFile(resolve(pageDirectory, 'source.html'), html, { flag: 'wx' })
  const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`alt="&${code};"`))
  const src = tag?.match(/\bsrc="([^"]+)"/)?.[1]
  if (!src || !record.split(' ').every(reference => html.includes(reference))) throw new Error(`${char}: catalogue reference differs; manual review required`)
  const originalUrl = new URL(src.replaceAll('&amp;', '&'), sourceRecordUrl)
  originalUrl.searchParams.set('size', '300')
  if (originalUrl.hostname !== 'xiaoxue.iis.sinica.edu.tw') throw new Error('Unexpected image host')
  await pause(800)
  const imageDirectory = resolve(entryDirectory, 'image')
  await mkdir(imageDirectory)
  const image = await fetch(originalUrl, { headers, signal: AbortSignal.timeout(30000) })
  if (!image.ok) throw new Error(`${char} image: HTTP ${image.status}; stopping, no fallback`)
  const bytes = Buffer.from(await image.arrayBuffer())
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.length > 1000000) throw new Error('Unexpected image format or size')
  await writeFile(resolve(imageDirectory, 'source.png'), bytes, { flag: 'wx' })
  records.push({ char, status: 'source-record-checked', kind: 'catalogue-image', image: `/glyph-sources/sinica-20261031/u${char.codePointAt(0).toString(16)}/image.png`, fileTitle: `小學堂 ${code}`, filePage: sourceRecordUrl, originalUrl: originalUrl.href, sourceRecordUrl, sourceCode: code, record, license: 'CC0 1.0（小學堂查询所得字形图片）', licensePage: 'https://xiaoxue.iis.sinica.edu.tw/License/License', credit: '字形图片来源：中央研究院小學堂文字學資料庫。本站未修改下载图片的笔形；字库图并非甲骨原拓。', sha256: createHash('sha256').update(bytes).digest('hex'), checkedAt: '2026-10-31' })
  console.log(`${char}: primary catalogue ${code}, ${record}; image saved for visual review`)
}
await writeFile(resolve(root, 'candidate-manifest.json'), JSON.stringify(records, null, 2) + '\n', { flag: 'wx' })
console.log('Research only: inspect the primary pages and images before adding any candidate to the app.')
