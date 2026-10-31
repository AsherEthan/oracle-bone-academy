import { expect, test } from '@playwright/test'
import curated from '../src/data/curated-headwords.json' with { type: 'json' }

test('all twelve reference entries offer attributed materials rather than a definition', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '有参考材料', exact: true }).click()
  for (const { order } of curated) {
    await page.getByRole('button', { name: `看看字头 ${order}`, exact: true }).click()
    const dialog = page.getByRole('dialog', { name: `字头 ${order} · 字形与材料` })
    await expect(dialog.locator('.reference-materials > p').first()).not.toBeEmpty()
    await expect(dialog.locator('.reference-materials .material-link')).toHaveAttribute('href', /^https:\/\/humanum\.arts\.cuhk\.edu\.hk\/Lexis\/lexi-mf\//)
    await expect(dialog.locator('.citation-boundary')).not.toBeEmpty()
    await expect(dialog.locator('.character-story, .look-closer, .detail-pinyin')).toHaveCount(0)
    await expect(dialog.locator('.detail-title-row h2')).toHaveText(`字头 ${order}`)
    await expect(dialog.locator('.detail-glyph-wrap img')).toHaveCount(1)
    await expect(dialog.locator('.detail-glyph-wrap img')).toHaveAttribute('alt', new RegExp(`^字头 ${order}：小學堂`))
    await expect(dialog.locator('.detail-sources')).toHaveJSProperty('open', false)
    await dialog.locator('.detail-sources > summary').click()
    await expect(dialog.getByRole('link', { name: '查看字例页', exact: true })).toHaveAttribute('href', /^https:\/\/xiaoxue\.iis\.sinica\.edu\.tw\/char\?fontcode=/)
    await page.keyboard.press('Escape')
  }
})

test('unverified drawing, decomposition, comparison and quiz routes stay withdrawn', async ({ page }) => {
  await page.goto('/')
  for (const label of ['现代字目录', '形意拆解', '形意对照', '自由描摹', '认字小练', '保存描摹卡片']) {
    await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0)
  }
  await page.getByRole('button', { name: '看看字头 806', exact: true }).click()
  await expect(page.locator('.part-row, .trace-canvas, .quiz-options, .comparison-grid')).toHaveCount(0)
  await expect(page.getByRole('dialog').locator('.detail-glyph-wrap svg')).toHaveCount(0)
})

test('a failed source image does not fall back to a fabricated shape', async ({ page }) => {
  await page.route('**/glyph-sources/sinica-*/u6b62/image.png', route => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: '看看字头 142', exact: true }).click()
  const art = page.getByRole('dialog').locator('.detail-glyph-wrap')
  await expect(art).toContainText('图片暂不可用')
  await expect(art.locator('img, svg, path')).toHaveCount(0)
})

test('random discovery and keyboard search work without adding extra tools', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '随遇一字' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('/')
  await expect(page.getByRole('textbox', { name: '搜索标签、拼音或编号' })).toBeFocused()
  await page.keyboard.type('ri')
  await expect(page.getByRole('button', { name: '看看字头 806', exact: true })).toBeVisible()
})
