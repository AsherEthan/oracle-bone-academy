import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

if (!process.argv[2]) throw new Error('Pass the project root; run this script outside downloaded directories')
const root = resolve(process.argv[2])
const output = resolve(root, 'public/glyph-sources/sinica-20261031')
const records = [
  ['止', '41.E74A', '甲1440 合31080', 'research/zhi-sinica-page/source.html', 'research/zhi-sinica-image/reference.png', '49bd430582cedde0c38ef0d2a9471fe7bc0f2c2c37c7d93dc2adc6dd7191c09b'],
  ['日', '42.ED48', '鐵180.2 合5216', 'research/primary-check-65e5/page.html', 'research/primary-image-65e5/reference.png', '7ede83edce8e8ba01859829ad4d4c1f1fd8e27ab996cca50acb1d72a6593836c'],
  ['月', '42.EEB0', '簠天1 合33694', 'research/primary-check-6708/page.html', 'research/primary-image-6708/reference.png', '3c3279efc458fd95dcb5328db44fb912d93db9bc502ff6303a4bd5722f07f143'],
  ['水', '43.E7BE', '甲903 合34165', 'research/primary-check-6c34/page.html', 'research/primary-image-6c34/reference.png', '4a224eca1939e125e8280531715bec4afed622b1135f71f15ace19c847d4a390'],
]
const license = await readFile(resolve(root, 'research/zhi-sinica-license/license.html'), 'utf8')
if (!license.includes('CC0 1.0') || !license.includes('字形圖片')) throw new Error('Review the primary image license first')
const manifest = []
for (const [char, code, record, pagePath, imagePath, expected] of records) {
  const html = await readFile(resolve(root, pagePath), 'utf8')
  const tag = [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).find(tag => tag.includes(`alt="&${code};"`))
  const src = tag?.match(/\bsrc="([^"]+)"/)?.[1]
  if (!src || !record.split(' ').every(reference => html.includes(reference))) throw new Error(`Primary record mismatch: ${char}`)
  const original = new URL(src.replaceAll('&amp;', '&'), 'https://xiaoxue.iis.sinica.edu.tw')
  original.searchParams.set('size', '300')
  const bytes = await readFile(resolve(root, imagePath))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (sha256 !== expected || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Image integrity mismatch: ${char}`)
  manifest.push({ char, status: 'source-record-checked', kind: 'catalogue-image', image: `/glyph-sources/sinica-20261031/u${char.codePointAt(0).toString(16)}/image.png`, fileTitle: `小學堂 ${code}`, filePage: `https://xiaoxue.iis.sinica.edu.tw/char?fontcode=${code}`, originalUrl: original.href, sourceRecordUrl: `https://xiaoxue.iis.sinica.edu.tw/char?fontcode=${code}`, sourceCode: code, record, license: 'CC0 1.0（小學堂查询所得字形图片）', licensePage: 'https://xiaoxue.iis.sinica.edu.tw/License/License', credit: '字形图片来源：中央研究院小學堂文字學資料庫。本站未修改下载图片的笔形；字库图并非甲骨原拓。', sha256, checkedAt: '2026-10-31', bytes })
}
await mkdir(output)
for (const { image, bytes } of manifest) {
  const target = resolve(root, 'public', image.slice(1))
  await mkdir(resolve(target, '..'))
  await writeFile(target, bytes, { flag: 'wx' })
}
await writeFile(resolve(root, 'src/data/source-manifest.json'), JSON.stringify(manifest.map(({ bytes, ...record }) => record), null, 2) + '\n')
console.log('Assembled 4 byte-identical primary catalogue images; no strokes redrawn. Not a scholarly authentication.')
