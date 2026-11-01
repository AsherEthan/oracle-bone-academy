import { expect, test } from '@playwright/test'
import corpus from '../src/data/corpus.json' with { type: 'json' }
import curated from '../src/data/curated-headwords.json' with { type: 'json' }
import visualIndex from '../src/data/visual-index.json' with { type: 'json' }

test('visible search examples and exact matches make the catalogue searchable without knowing a source number', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: '搜索标签、拼音或编号' })).toHaveAttribute('placeholder', /合34165/)
  await page.getByRole('button', { name: '查目录标签水', exact: true }).click()
  await expect(page.locator('.card-open').first()).toHaveAttribute('aria-label', '看看字头 1265')
  await expect(page.locator('.search-match').first()).toHaveText('匹配来源目录标签')
  await page.getByRole('textbox').fill('142')
  await expect(page.locator('.card-open').first()).toHaveAttribute('aria-label', '看看字头 142')
})

test('a source-code search previews and opens the matching non-default example without transferring reference material', async ({ page }) => {
  const initial = curated.find(item => item.order === 142)!
  const example = corpus.records.find(item => item.order === 142)!.examples.find(item => item.code !== initial.sourceCode)!
  await page.goto('/')
  await page.getByRole('textbox').fill(example.code)
  const card = page.getByRole('button', { name: '看看字头 142', exact: true })
  await expect(card.locator('img')).toHaveAttribute('src', new RegExp(`glyph-${example.code.toLowerCase().replace('.', '-')}/image.png$`))
  await card.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.record-materials')).toContainText(example.code)
  await expect(dialog.locator('.record-materials')).toContainText(example.reference)
  await expect(dialog.locator('.reference-materials')).toHaveCount(0)
})

test('visual browsing uses actual images, measurable outlines and bounded pages', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByRole('group', { name: '选择寻找方式' }).getByRole('button', { name: /按图找字/ }).click()
  await expect(page.locator('.visual-grid .glyph-card')).toHaveCount(96)
  await expect(page.getByRole('textbox')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: '选择字库页码' })).toHaveValue('1')
  await page.getByRole('group', { name: '按展图轮廓筛选' }).getByRole('button', { name: '偏宽', exact: true }).click()
  const expected = Object.values(visualIndex.records).filter(metric => Number(metric[1]) / Number(metric[2]) > 1.25).length
  await expect(page.locator('.browse-result-line')).toContainText(`${expected.toLocaleString()} 个字头`)
  await expect(page.locator('.visual-grid .glyph-card')).toHaveCount(Math.min(96, expected))
  await page.locator('.source-glyph').first().scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('.source-glyph').first().evaluate(image => (image as HTMLImageElement).naturalWidth > 0), { timeout: 15000 }).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: `artifacts/finding-visual-${testInfo.project.name}.png`, animations: 'disabled' })
  await page.locator('.card-open').first().click()
  await expect(page.getByRole('dialog').locator('.detail-glyph-wrap img')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('group', { name: '选择寻找方式' }).getByRole('button', { name: '输入线索', exact: true }).click()
  await expect(page.locator('.glyph-card')).toHaveCount(48)
  await expect(page.getByRole('textbox')).toBeVisible()
})

test('an empty outline filter in the collection does not claim saved glyphs are missing', async ({ page }) => {
  const [order] = Object.entries(visualIndex.records).find(([, metric]) => Number(metric[1]) / Number(metric[2]) > 1.25)!
  await page.addInitScript(id => localStorage.setItem('zizai.collection.v1', JSON.stringify([id])), `sinica-jgw-${order}`)
  await page.goto('/')
  await page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: /拾字簿/ }).click()
  await expect(page.locator('.glyph-card')).toHaveCount(1)
  await page.getByRole('group', { name: '选择寻找方式' }).getByRole('button', { name: /按图找字/ }).click()
  await page.getByRole('group', { name: '按展图轮廓筛选' }).getByRole('button', { name: '偏高', exact: true }).click()
  await expect(page.locator('.glyph-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '还没找到这个字。' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '还没有拾起的字。' })).toHaveCount(0)
  await page.getByRole('button', { name: '清除筛选', exact: true }).click()
  await expect(page.locator('.glyph-card')).toHaveCount(1)
  await page.getByRole('group', { name: '选择寻找方式' }).getByRole('button', { name: '输入线索', exact: true }).click()
  await page.getByRole('textbox').fill('45.E538')
  await expect(page.locator('.glyph-card')).toHaveCount(0)
  await page.getByRole('button', { name: '在全部字库中找', exact: true }).click()
  await expect(page.getByRole('button', { name: '看看字头 3500', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('button', { name: '逛字馆', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('a restrictive filter can be expanded instead of claiming the glyph does not exist', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '有参考材料', exact: true }).click()
  await page.getByRole('textbox').fill('45.E538')
  await expect(page.locator('.glyph-card')).toHaveCount(0)
  await page.getByRole('button', { name: '在全部字库中找', exact: true }).click()
  await expect(page.getByRole('button', { name: '看看字头 3500', exact: true })).toBeVisible()
  await page.getByRole('textbox').fill('不存在的字XYZ')
  await page.getByRole('group', { name: '选择寻找方式' }).getByRole('button', { name: /按图找字/ }).click()
  await expect(page.locator('.visual-grid .glyph-card')).toHaveCount(96)
})
