import { chromium, devices, expect } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const baseURL = (process.argv[3] ?? 'http://127.0.0.1:4173').replace(/\/+$/, '') + '/'
if (!(await fetch(baseURL)).ok) throw new Error('Production preview is not serving')
const output = `${root}/artifacts`
const corpus = JSON.parse(await readFile(`${root}/src/data/corpus.json`, 'utf8'))
const curated = JSON.parse(await readFile(`${root}/src/data/curated-headwords.json`, 'utf8'))
const headwords = new Set([...corpus.records, ...curated].map(record => record.order)).size
const unlabelled = corpus.records.filter(record => !record.labels.length).length
const lastHeadword = Math.max(...corpus.records.map(record => record.order))
const pageSize = 48
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
try {
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext(mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = [], external = [], failedResponses = []
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`)
    })
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url())
    })
    const started = Date.now()
    await page.goto(baseURL)
    await expect(page.locator('.glyph-card')).toHaveCount(48)
    await expect(page.locator('.browse-result-line')).toContainText(`${headwords.toLocaleString()} 个字头`)
    await page.evaluate(() => document.fonts.ready)
    await expect.poll(() => page.locator('.source-glyph').first().evaluate(image => image.naturalWidth > 0)).toBe(true)
    const firstPaint = Date.now() - started
    await page.screenshot({ path: `${output}/corpus-production-home-${mode}.png`, animations: 'disabled' })

    await page.getByRole('combobox', { name: '选择字库页码' }).selectOption(String(Math.ceil(headwords / pageSize)))
    await expect(page.locator('.glyph-card')).toHaveCount(headwords % pageSize || pageSize)
    await expect(page.getByRole('button', { name: '下一页', exact: true })).toBeDisabled()
    await page.locator('.card-open').last().click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.locator('.detail-glyph-wrap img')).toBeVisible()
    await dialog.locator('.detail-sources > summary').click()
    await expect(dialog.getByRole('link', { name: '查看字头页', exact: true })).toHaveAttribute('href', `https://xiaoxue.iis.sinica.edu.tw/jiaguwen?ZiOrder=${lastHeadword}`)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: '未标汉字', exact: true }).click()
    await expect(page.locator('.browse-result-line')).toContainText(`${unlabelled.toLocaleString()} 个字头`)
    await page.locator('.card-open').first().click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('.detail-sources')).toHaveJSProperty('open', false)
    await expect.poll(() => dialog.locator('.detail-glyph-wrap img').evaluate(image => image.naturalWidth > 0)).toBe(true)
    await page.screenshot({ path: `${output}/corpus-production-unlabelled-${mode}.png`, animations: 'disabled' })
    await dialog.getByRole('button', { name: /^收藏字头/ }).click()
    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /拾字簿/ }).click()
    await expect(page.locator('.glyph-card')).toHaveCount(1)
    await page.getByRole('button', { name: /^取消收藏字头/ }).click()
    await expect(page.getByRole('heading', { name: '还没有拾起的字。' })).toBeVisible()
    await page.getByRole('button', { name: '去逛逛' }).click()
    await page.getByRole('textbox', { name: '搜索标签、拼音或编号' }).fill('shui')
    await page.getByRole('button', { name: '看看字头 1265', exact: true }).first().click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('.reference-materials')).toContainText('流水')
    await expect(dialog.locator('.detail-title-row h2')).toHaveText('字头 1265')
    await expect(dialog.locator('.detail-pinyin, .character-story')).toHaveCount(0)
    await expect(dialog.locator('.catalogue-labels')).toContainText('不作为本站对字形的定名或释义')
    await page.screenshot({ path: `${output}/materials-production-reference-${mode}.png`, animations: 'disabled' })
    await dialog.locator('.detail-sources > summary').click()
    await expect(dialog.getByRole('link', { name: '查看字例页', exact: true })).toHaveAttribute('href', 'https://xiaoxue.iis.sinica.edu.tw/char?fontcode=43.E7BE')
    if (errors.length || external.length || failedResponses.length) throw new Error(JSON.stringify({ mode, errors, external, failedResponses }))
    console.log(JSON.stringify({ mode, initialRenderMilliseconds: firstPaint, cardsPerPage: 48, headwords, unlabelled, lastHeadword, pageErrors: errors.length, externalRequests: external.length, failedResponses: failedResponses.length }))
    await context.close()
  }
  const samples = [corpus.records[0], corpus.records[20], corpus.records.at(-1)]
  for (const record of samples) {
    const example = record.examples[0]
    const path = `/glyph-sources/sinica-corpus-20261031/glyph-${example.code.toLowerCase().replace('.', '-')}/image.png`
    const response = await fetch(new URL(path.slice(1), baseURL))
    if (!response.ok) throw new Error(`Missing served asset ${path}`)
    const hash = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
    if (hash !== example.sha256) throw new Error(`Served image hash mismatch ${example.code}`)
  }
  console.log('Representative production image hashes match the source manifest.')
} finally {
  await browser.close()
}
