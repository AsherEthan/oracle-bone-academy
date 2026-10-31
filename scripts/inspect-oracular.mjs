import { readFile, mkdir, writeFile } from 'node:fs/promises'

const root = process.argv[2]
if (!root) throw new Error('Pass the project root')
for (const name of ['research/oracular-index-20261031/source.html', 'research/oracular-font-styles-20261031/entry.css']) {
  const text = await readFile(`${root}/${name}`, 'utf8')
  for (const match of text.matchAll(/oracular|woff|ttf/gi)) {
    const context = text.slice(Math.max(0, match.index - 120), match.index + 230)
    if (context.includes('url(') || context.includes('font-face') || context.includes('woff')) console.log(context)
  }
}
const moduleText = await readFile(`${root}/research/oracular-page-modules-20261031/BzUzYTo2.js`, 'utf8')
const pos = moduleText.indexOf('const i={page:')
console.log(moduleText.slice(pos - 4500, pos + 900))
const dir = `${root}/research/oracular-catalogue-sample-20261031`
await mkdir(dir)
const payload = { page: 1, page_size: 66, 显示模式: '字头', 字头类型: [], 著录来源: [], 组类: [], 标签: [], 释读: [], 隶定: '' }
const response = await fetch('https://oracular.azurewebsites.net/api/joint-glyph-data/', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000),
})
console.log('Catalogue HTTP', response.status)
const body = await response.text()
await writeFile(`${dir}/response.json`, body, { flag: 'wx' })
console.log(body.slice(0, 6500))
