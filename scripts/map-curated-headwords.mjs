import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(process.argv[2] ?? '.')
const dir = `${root}/research/sinica-curated-headwords-20261031`
await mkdir(dir)
const sources = JSON.parse(await readFile(`${root}/src/data/source-manifest.json`, 'utf8'))
const mapping = []
for (const source of sources) {
  await new Promise(resolve => setTimeout(resolve, 1200))
  const char = source.char === '鱼' ? '魚' : source.char
  const response = await fetch('https://xiaoxue.iis.sinica.edu.tw/jiaguwen/PageResult/PageResult', {
    method: 'POST', body: new URLSearchParams({ EudcFontChar: char, PaginalZiNum: '5', ImageSize: '36' }), signal: AbortSignal.timeout(45000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const html = await response.text()
  await writeFile(`${dir}/u${char.codePointAt(0).toString(16)}.html`, html, { flag: 'wx' })
  const order = html.match(/id="ZiOrder"[^>]*value="(\d+)"/)?.[1]
  console.log(source.char, order, html.match(/id="StartOrder"[^>]*>([\s\S]{0,250})/)?.[1])
  if (!order) throw new Error(`No native headword for ${char}`)
  mapping.push({ char: source.char, order: Number(order), sourceCode: source.sourceCode })
}
await writeFile(`${dir}/mapping.json`, JSON.stringify(mapping, null, 2), { flag: 'wx' })
