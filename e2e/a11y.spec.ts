import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/** 라이트·다크를 둘 다 본다. 다크에서만 명암비가 깨지는 일이 흔하다. */
const SCHEMES = ['light', 'dark'] as const

for (const scheme of SCHEMES) {
  test.describe(`접근성 ${scheme}`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 390, height: 844 } })

    test('오늘 화면', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(results.violations).toEqual([])
    })

    test('세션 화면 — 네 박자 전부', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /오늘 연습 시작/ }).click()

      const steps = ['들었다, 다음', '따라 말했다, 다음', '말했다, 들어 보기']
      for (const [index, label] of ['', ...steps].entries()) {
        if (index > 0) await page.getByRole('button', { name: label }).click()
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()

        expect(results.violations, `박자 ${index + 1}`).toEqual([])
      }
    })
  })
}

test.describe('키보드만으로', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('세션을 시작하고 한 박자 넘긴다', async ({ page }) => {
    await page.goto('/')
    // 읽기가 끝나 버튼이 생긴 뒤에 Tab 을 눌러야 한다. 그 전에는 받을 요소가 없다.
    await expect(page.getByRole('button', { name: /오늘 연습 시작/ })).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /오늘 연습 시작/ })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('듣기')
    await page.getByRole('button', { name: '들었다, 다음' }).focus()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('겹쳐 말하기')
  })
})

test.describe('장식 모션을 끈 상태', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })

  test('핵심 흐름이 그대로 된다', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /오늘 연습 시작/ }).click()

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('듣기')
  })
})
