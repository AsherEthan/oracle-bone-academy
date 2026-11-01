import { chromium, devices, expect } from '@playwright/test'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(process.argv[2] ?? '.')
const baseURL = (process.argv[3] ?? 'http://127.0.0.1:4180').replace(/\/+$/, '') + '/'
if (!(await fetch(baseURL)).ok) throw new Error('Production preview is not serving')
const corpus = JSON.parse(await readFile(`${root}/src/data/corpus.json`, 'utf8'))
const curated = JSON.parse(await readFile(`${root}/src/data/curated-headwords.json`, 'utf8'))
const primary = curated.find(item => item.order === 142)
const alternate = corpus.records.find(item => item.order === 142).examples.find(item => item.code !== primary.sourceCode)
await mkdir(`${root}/artifacts`, { recursive: true })
const browser = await chromium.launch()
try {
  for (const mode of ['desktop', 'mobile']) {
    const context = await browser.newContext(mode === 'mobile' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = [], failed = [], external = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { if (response.status() >= 400) failed.push(response.url()) })
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url()) })
    await page.goto(baseURL)
    await expect(page.locator('.glyph-card')).toHaveCount(48)
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: `${root}/artifacts/finding-production-home-${mode}.png`, animations: 'disabled' })
    await page.getByRole('button', { name: '查目录标签水', exact: true }).click()
    await expect(page.locator('.card-open').first()).toHaveAttribute('aria-label', '看看字头 1265')
    await page.getByRole('textbox').fill(alternate.code.replace('.', ' '))
    await page.getByRole('button', { name: '看看字头 142', exact: true }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.locator('.record-materials')).toContainText(alternate.code)
    await expect(dialog.locator('.reference-materials')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.getByRole('group', { name: '选择寻找方式' }).getByRole('button', { name: /按图找字/ }).click()
    await expect(page.locator('.visual-grid .glyph-card')).toHaveCount(96)
    await page.getByRole('group', { name: '按展图轮廓筛选' }).getByRole('button', { name: '偏高', exact: true }).click()
    await expect.poll(() => page.locator('.source-glyph').first().evaluate(image => image.naturalWidth > 0)).toBe(true)
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) throw new Error(`${mode}: horizontal overflow`)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({ path: `${root}/artifacts/finding-production-visual-${mode}.png`, animations: 'disabled' })
    await page.getByRole('button', { name: '未标汉字', exact: true }).click()
    const card = page.locator('.card-open').first()
    const label = await card.getAttribute('aria-label')
    await card.click()
    dialog = page.getByRole('dialog')
    await expect(dialog.locator('.detail-glyph-wrap img')).toBeVisible()
    await dialog.getByRole('button', { name: /^收藏字头/ }).click()
    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /拾字簿/ }).click()
    await expect(page.locator('.glyph-card')).toHaveCount(1)
    await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible()
    if (errors.length || failed.length || external.length) throw new Error(JSON.stringify({ mode, errors, failed, external }))
    console.log(JSON.stringify({ mode, exactLabelSearch: true, matchingExampleOpens: alternate.code, visualFilters: true, bookmarksPersist: true, pageErrors: errors.length, failedResponses: failed.length, externalRequests: external.length }))
    await context.close()
  }
} finally {
  await browser.close()
}
