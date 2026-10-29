import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /오늘 연습 시작/ })).toBeVisible()
})

test('독으로 네 화면을 오간다', async ({ page }) => {
  await page.getByRole('link', { name: '묶음' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '묶음' })).toBeVisible()

  await page.getByRole('link', { name: '기록' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '기록' })).toBeVisible()

  await page.getByRole('link', { name: '설정' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '설정' })).toBeVisible()

  await page.getByRole('link', { name: '오늘' }).click()
  await expect(page.getByRole('button', { name: /오늘 연습 시작/ })).toBeVisible()
})

test('묶음 하나만 골라 연습할 수 있다 — 면접 직전에 쓰는 길이다', async ({ page }) => {
  await page.getByRole('link', { name: '묶음' }).click()
  await page.getByRole('button', { name: /못 들었을 때/ }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('듣기')
  // 그 묶음의 문장만 나온다
  await expect(page.locator('.stage__ko')).toBeVisible()
  await expect(page.locator('.stage__count')).toHaveText('1 / 8')
})

test('세션을 끝내면 요약이 나오고 막힌 문장이 다시 보인다', async ({ page }) => {
  await page.getByRole('link', { name: '설정' }).click()
  await page.getByRole('group', { name: '하루 분량' }).getByRole('button', { name: '5장' }).click()
  await page.getByRole('link', { name: '오늘' }).click()
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()

  // 5장을 전부 '막혔다' 로 — 막힌 문장은 세션 안에서 한 번 더 나오므로 10번 채점한다
  for (let card = 0; card < 10; card += 1) {
    const done = await page.getByRole('link', { name: '오늘로 돌아가기' }).isVisible()
    if (done) break
    await page.getByRole('button', { name: '들었다, 다음' }).click()
    await page.getByRole('button', { name: '따라 말했다, 다음' }).click()
    await page.getByRole('button', { name: '말했다, 들어 보기' }).click()
    await page.getByRole('button', { name: /막혔다/ }).click()
  }

  await expect(page.getByRole('heading', { level: 1 })).toContainText('문장을 입으로 냈어요')
  await expect(page.getByText(/막힌 문장 \d+개/)).toBeVisible()

  // 기록 화면에도 그 문장이 쌓인다
  await page.getByRole('link', { name: '오늘로 돌아가기' }).click()
  await page.getByRole('link', { name: '기록' }).click()
  await expect(page.getByRole('heading', { name: '막힌 문장' })).toBeVisible()
  await expect(page.getByTitle('막힌 횟수').first()).toBeVisible()
})

test('설정이 다시 열어도 남는다', async ({ page }) => {
  await page.getByRole('link', { name: '설정' }).click()
  const daily = page.getByRole('group', { name: '하루 분량' })
  await daily.getByRole('button', { name: '12장' }).click()
  await page.getByRole('button', { name: '다크' }).click()

  await page.goto('/#/settings')
  await expect(daily.getByRole('button', { name: '12장' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('백업을 내려받을 수 있다', async ({ page }) => {
  await page.getByRole('link', { name: '설정' }).click()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: '내보내기' }).click()
  const file = await download

  expect(file.suggestedFilename()).toMatch(/^gosay-\d{8}\.json$/)
})

for (const [name, path] of [
  ['묶음', '#/tracks'],
  ['기록', '#/stats'],
  ['설정', '#/settings'],
] as const) {
  test(`접근성 — ${name} 화면`, async ({ page }) => {
    await page.goto(`/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations).toEqual([])
  })
}

test('새 화면에서도 가로 넘침이 없다', async ({ page }) => {
  for (const path of ['#/tracks', '#/stats', '#/settings']) {
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto(`/${path}`)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${path} ${width}px`).toBeLessThanOrEqual(0)
    }
  }
})
