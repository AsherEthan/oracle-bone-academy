import { copyFile, lstat, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
if (!process.argv[3]) throw new Error('Pass a new, empty publication directory as the third argument')
const output = resolve(process.argv[3])
if (output === root || root.startsWith(output + sep)) throw new Error('Publication must not replace the project or its parent')
await mkdir(output, { recursive: true })
if ((await readdir(output)).length) throw new Error('Publication directory must be empty')
const corpus = JSON.parse(await readFile(`${root}/src/data/corpus.json`, 'utf8'))
if (!corpus.nativeRangeRows || !corpus.nativeRangeCoverage?.complete) throw new Error('Only export the completed, imported native-range batch')

// Publish licensed query attributes, not the source website scripts or page layout.
function attributeExcerpt(html, path) {
  if (path === 'research/zhi-sinica-license/license.html') return html
  const lines = ['<!-- Extracted query attributes, not an original page snapshot. See THIRD_PARTY.md. -->']
  for (const pattern of [/共搜尋到\d+字(?:／\d+頁)?/, /<span id="StartOrder">\d+<\/span>/, /<span id="Reference">[\s\S]*?<\/span>/]) {
    const match = html.match(pattern)
    if (match) lines.push(match[0].replace(/<(?!\/?(?:span|br)\b)[^>]*>/gi, ''))
  }
  function imageTag(tag) {
    const alt = tag.match(/\balt="(&(?:0|4[1-9])\.[A-F0-9]+;)"/i)?.[1]
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1]
    if (!alt || !src) return undefined
    const url = new URL(src.replaceAll('&amp;', '&'), 'https://xiaoxue.iis.sinica.edu.tw')
    if (url.origin !== 'https://xiaoxue.iis.sinica.edu.tw' || url.pathname !== '/ImageText2/ShowImage.ashx') throw new Error(`Unexpected attribute image in ${path}`)
    return `<img src="${src}" alt="${alt}">`
  }
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = imageTag(match[0])
    if (tag) lines.push(tag)
  }
  for (const match of html.matchAll(/(<img\b[^>]*>)\s*<br\s*\/>\s*<a href="(\/jiaguwen\?(?:kaiOrder=\d+&)?ZiOrder=\d+)"[^>]*>(\d+)<\/a>/g)) {
    const tag = imageTag(match[1])
    if (tag) lines.push(`${tag}<br /><a href="${match[2]}">${match[3]}</a>`)
  }
  if (lines.length === 1) throw new Error(`No publishable attributes in ${path}`)
  return lines.join('\n') + '\n'
}

let files = 0
async function copy(path) {
  const from = resolve(root, path), to = resolve(output, path)
  const info = await lstat(from)
  if (info.isSymbolicLink()) throw new Error(`Refusing symbolic link ${path}`)
  if (info.isDirectory()) {
    for (const entry of await readdir(from)) await copy(`${path}/${entry}`)
    return
  }
  if (!info.isFile()) throw new Error(`Unexpected file type ${path}`)
  if (path.startsWith('research/') && !/\.(?:json|png|html)$/.test(path)) return
  await mkdir(dirname(to), { recursive: true })
  if (path.startsWith('research/') && path.endsWith('.html')) await writeFile(to, attributeExcerpt(await readFile(from, 'utf8'), path), { flag: 'wx' })
  else await copyFile(from, to, 1)
  files++
}
for (const path of [
  '.gitignore', '.github', 'README.md', 'THIRD_PARTY.md', 'index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'src',
  'public/favicon.svg', 'public/fonts', 'public/glyph-sources/sinica-20261031',
  'public/glyph-sources/sinica-corpus-20261031', 'scripts', 'tests',
  ...['sinica-corpus-20261031', 'sinica-unlisted-headwords-20261031', 'sinica-native-range-20261031',
    'sinica-curated-headwords-20261031', 'sinica-next-eight-20261031', 'zhi-sinica-page', 'zhi-sinica-image',
    'zhi-sinica-license', 'primary-check-65e5', 'primary-check-6708', 'primary-check-6c34',
    'primary-image-65e5', 'primary-image-6708', 'primary-image-6c34'].map(name => `research/${name}`),
]) await copy(path)
console.log(JSON.stringify({ output: relative(root, output), files, headwords: corpus.headwordCount, nativeRangeRows: corpus.nativeRangeRows, researchHtml: 'CC0 attribute excerpts; original snapshots retained only in the working archive' }))
