import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const approved = [
  ['止', '止', '41.E74A', '甲1440 合31080'],
  ['日', '日', '42.ED48', '鐵180.2 合5216'],
  ['月', '月', '42.EEB0', '簠天1 合33694 歷組'],
  ['山', '山', '', '合5431'],
  ['水', '水', '43.E7BE', '甲903 合34165'],
  ['火', '火', '43.E513', '前6.49.3 合17067'],
  ['雨', '雨', '43.EA46', '佚55'],
  ['人', '人', '42.F47D', '甲2940 合18901'],
  ['大', '大', '43.E628', '林1.9.6'],
  ['女', '女', '43.EC6E', '前7.36.1 合3298 賓組'],
  ['子', '子', '44.E079', '乙6702'],
  ['目', '目', '41.F455', '鐵16.1 合11654'],
  ['口', '口', '41.E513', '甲1193'],
  ['田', '田', '43.F31B', '菁1.1 合6057 賓組'],
  ['牛', '牛', '41.E431', '乙6964 合9525 賓組'],
  ['羊', '羊', '41.F800', '佚450 合33949'],
  ['鱼', '魚', '43.EAFC', '前4.56.1 合10492'],
].filter(([, , code]) => code)

const target = resolve(process.argv[2])
const audit = resolve(process.argv[3])
if (!process.argv[2] || !process.argv[3]) throw new Error('Pass new, empty asset and audit directories')
const localOnly = process.argv.includes('--local-only')
if (!localOnly) {
  await mkdir(resolve(target, '..'), { recursive: true })
  await mkdir(resolve(audit, '..'), { recursive: true })
  await mkdir(target)
  await mkdir(audit)
}
const headers = { 'User-Agent': 'ZiZai-source-audit/1.0 (local educational research)' }
const query = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo|revisions', iiprop: 'url|extmetadata|timestamp|sha1', rvprop: 'ids|timestamp', titles: approved.map(([, fileChar]) => `File:${fileChar}-oracle.svg`).join('|') })
let raw
if (localOnly) {
  raw = await readFile(resolve(audit, 'commons-response.json'), 'utf8')
} else {
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${query}`, { headers })
  if (!response.ok) throw new Error(`Commons metadata: HTTP ${response.status}`)
  raw = await response.text()
  await writeFile(resolve(audit, 'commons-response.json'), raw, { flag: 'wx' })
}
const pages = Object.values(JSON.parse(raw).query.pages)
const strip = text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
const manifest = []
for (const [char, fileChar, code, record] of approved) {
  const title = `File:${fileChar}-oracle.svg`
  const page = pages.find(page => page.title === title)
  const info = page?.imageinfo?.[0]
  if (!info) throw new Error(`Missing source: ${title}`)
  const meta = info.extmetadata
  const credit = strip(meta.Credit?.value || '')
  if (!credit.includes(code) || !credit.includes(record)) throw new Error(`Source reference changed: ${title}`)
  if (!/Shang oracle script/.test(strip(meta.ImageDescription?.value || ''))) throw new Error(`Not labelled oracle script: ${title}`)
  if (meta.LicenseShortName?.value !== 'Public domain') throw new Error(`License needs manual review: ${title}`)
  const original = new URL(info.url)
  original.search = ''
  if (original.hostname !== 'upload.wikimedia.org') throw new Error('Unexpected asset host')
  const filename = `u${char.codePointAt(0).toString(16)}.svg`
  let bytes
  if (localOnly) {
    try { bytes = await readFile(resolve(target, filename)) } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
  } else {
    const image = await fetch(original, { headers })
    if (image.status === 429) { console.warn('Source server rate-limited the download; stopping without inventing replacements.'); break }
    if (!image.ok) throw new Error(`Glyph asset: ${image.status}`)
    bytes = Buffer.from(await image.arrayBuffer())
  }
  const markup = bytes.toString('utf8')
  if (!/<svg[\s>]/i.test(markup) || /<(?:script|foreignObject|image)\b|\bon\w+\s*=|<!ENTITY/i.test(markup)) throw new Error(`SVG needs security review: ${title}`)
  const sha1 = createHash('sha1').update(bytes).digest('hex')
  if (sha1 !== info.sha1) throw new Error(`Source file changed during download: ${title}`)
  if (!localOnly) await writeFile(resolve(target, filename), bytes, { flag: 'wx' })
  manifest.push({ char, status: 'source-record-checked', kind: 'digital-tracing', image: `/glyph-sources/commons-20261031/${filename}`, fileTitle: title, filePage: `${info.descriptionurl}?oldid=${page.revisions[0].revid}`, originalUrl: original.href, sourceRecordUrl: `https://xiaoxue.iis.sinica.edu.tw/char?fontcode=${code}`, sourceCode: code, record, license: 'Public domain（依 Commons 文件页声明）', licensePage: `${info.descriptionurl}#Licensing`, credit: '数字摹本见 Wikimedia Commons 文件历史中的贡献者；字例出处据文件页的中研院小學堂索引及著录记录。', sha256: createHash('sha256').update(bytes).digest('hex'), checkedAt: new Date().toISOString().slice(0, 10), fileRevisionAt: info.timestamp, pageRevision: page.revisions[0].revid })
  console.log(`${char}: ${code} · ${record} · SHA-1 matched`)
}
await writeFile(resolve(audit, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' })
// Commons is retained as research evidence only; do not overwrite the app's primary-source manifest.
console.log(`Imported ${manifest.length} source-attributed digital tracings; not original rubbings, not a scholarly authentication.`)
