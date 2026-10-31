import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

async function collectSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const sources = await Promise.all(entries.map(entry => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return collectSources(path)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') ? readFile(path, 'utf8') : ''
  }))
  return sources.join('\n')
}

const target = resolve(process.argv[2] || 'public/fonts/serif')
const source = await collectSources('src')
const characters = [...new Set(source.match(/[\p{Script=Han}a-zA-Z0-9À-ɏ，。·、！？（）「」《》“”]/gu) || [])].sort()
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const chunks = Array.from({ length: Math.ceil(characters.length / 120) }, (_, index) => characters.slice(index * 120, (index + 1) * 120).join(''))
await mkdir(target, { recursive: true })
const styles = []
for (const [index, chunk] of chunks.entries()) {
  const response = await fetch(`https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400..700&display=swap&text=${encodeURIComponent(chunk)}`, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) throw new Error(`Font stylesheet: HTTP ${response.status}`)
  const css = await response.text()
  const fontUrl = css.match(/url\((https:\/\/[^)]+)\)/)?.[1]
  if (!fontUrl || (css.match(/@font-face/g) || []).length !== 1) throw new Error('Expected a single text subset')
  const font = await fetch(fontUrl)
  if (!font.ok) throw new Error(`Font file: HTTP ${font.status}`)
  const bytes = Buffer.from(await font.arrayBuffer())
  if (bytes.subarray(0, 4).toString() !== 'wOF2') throw new Error('Expected WOFF2 font')
  const name = `noto-serif-sc-${index}.woff2`
  await writeFile(resolve(target, name), bytes, { flag: 'wx' })
  styles.push(css.replace(fontUrl, `./${name}`))
  console.log(`${name}: ${bytes.length} bytes`)
}
const license = await fetch('https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/LICENSE')
if (!license.ok) throw new Error(`Font license: HTTP ${license.status}`)
await writeFile(resolve(target, 'OFL.txt'), await license.text(), { flag: 'wx' })
await writeFile(resolve(target, 'font.css'), styles.join('\n'), { flag: 'wx' })
console.log(`Saved ${characters.length} characters in ${chunks.length} self-hosted subsets with OFL license.`)
