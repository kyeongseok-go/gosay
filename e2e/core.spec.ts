import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

/** 코퍼스가 가리키는 음원 경로. Playwright 는 JSON import 를 쓰지 않으므로 직접 읽는다. */
const audioIndex: Record<string, string> = JSON.parse(
  readFileSync(new URL('../src/content/audio-index.json', import.meta.url), 'utf8'),
)

/** 아이폰 세로. HANDOFF 의 기준 화면이다. */
const PHONE = { width: 390, height: 844 }

test.use({ viewport: PHONE })

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  // 각 테스트가 끝날 때 콘솔 오류를 확인할 수 있게 매단다.
  ;(page as unknown as { __errors: string[] }).__errors = errors
  await page.goto('/')
})

test('첫 화면에서 한 번 눌러 세션이 시작된다', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('나오는 문장')

  const start = page.getByRole('button', { name: /오늘 연습 시작/ })
  await expect(start).toBeEnabled()
  await start.click()

  await expect(page).toHaveURL(/#\/session$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('듣기')
})

test('4박자를 끝까지 지나 채점하면 다음 카드로 간다', async ({ page }) => {
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()

  const first = await page.locator('.stage__ko').textContent()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('듣기')
  await page.getByRole('button', { name: '들었다, 다음' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('겹쳐 말하기')
  await page.getByRole('button', { name: '따라 말했다, 다음' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가린 채 말하기')
  // 3박자에서는 영어가 가려져 있다. 이게 이 앱의 존재 이유다.
  await expect(page.locator('.stage__en')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '도저히 안 나오면 열기' })).toBeVisible()

  await page.getByRole('button', { name: '말했다, 들어 보기' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('대조와 채점')
  // 4박자에서는 영어가 다시 보이고, 두 소리를 번갈아 들을 수 있다.
  await expect(page.locator('.stage__en')).toBeVisible()
  await expect(page.getByRole('button', { name: '기준 음원' })).toBeVisible()

  await page.getByRole('button', { name: /바로 나왔다/ }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('듣기')
  await expect(page.locator('.stage__ko')).not.toHaveText(first ?? '')
  await expect(page.locator('.stage__count')).toHaveText('2 / 8')
})

test('3박자에서 열기를 누르면 영어가 보인다 — 포기하지 않게', async ({ page }) => {
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()
  await page.getByRole('button', { name: '들었다, 다음' }).click()
  await page.getByRole('button', { name: '따라 말했다, 다음' }).click()

  await page.getByRole('button', { name: '도저히 안 나오면 열기' }).click()

  await expect(page.locator('.stage__en')).toBeVisible()
})

test('마이크 권한이 없어도 흐름이 막히지 않는다', async ({ page }) => {
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()
  await page.getByRole('button', { name: '들었다, 다음' }).click()
  await page.getByRole('button', { name: '따라 말했다, 다음' }).click()

  // 녹음을 누르지 않고 바로 넘어간다
  await page.getByRole('button', { name: '말했다, 들어 보기' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('대조와 채점')
  // 녹음이 없으면 '내 녹음' 버튼은 눌리지 않지만 채점은 된다
  await expect(page.getByRole('button', { name: '내 녹음' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /막혔다/ })).toBeEnabled()
})

test('앱을 닫았다 열면 같은 자리에서 이어진다 — 중단 복원', async ({ page }) => {
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()
  await page.getByRole('button', { name: '들었다, 다음' }).click()
  await page.getByRole('button', { name: '따라 말했다, 다음' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가린 채 말하기')

  const ko = await page.locator('.stage__ko').textContent()

  // 지하철에서 내려 앱이 닫힌 상황. 설치한 PWA 는 다시 열 때 start_url('./')로 들어온다.
  await page.goto('/')
  await expect(page.getByRole('button', { name: /이어서 하기/ })).toBeVisible()
  await page.getByRole('button', { name: /이어서 하기/ }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('가린 채 말하기')
  await expect(page.locator('.stage__ko')).toHaveText(ko ?? '')
})

test('채점한 것이 다시 열어도 남아 있다', async ({ page }) => {
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()
  await page.getByRole('button', { name: '들었다, 다음' }).click()
  await page.getByRole('button', { name: '따라 말했다, 다음' }).click()
  await page.getByRole('button', { name: '말했다, 들어 보기' }).click()
  await page.getByRole('button', { name: /바로 나왔다/ }).click()

  await page.goto('/')
  await expect(page.locator('.facts__cell').first()).toContainText('1')
})

test('세션을 접으면 오늘로 돌아오고 진행이 남는다', async ({ page }) => {
  await page.getByRole('button', { name: /오늘 연습 시작/ }).click()
  await page.getByRole('button', { name: '들었다, 다음' }).click()
  await page.getByRole('button', { name: '접기' }).click()

  await expect(page).toHaveURL(/#\/$/)
  await expect(page.getByRole('button', { name: /오늘 연습 시작/ })).toBeVisible()
})

test('코퍼스가 가리키는 기준 음원이 실제로 번들돼 있다', async ({ page }) => {
  // 404 면 지하철에서 소리가 안 난다. 색인의 모든 경로를 직접 받아 본다.
  const paths = Object.values(audioIndex)
  expect(paths.length).toBeGreaterThanOrEqual(40)

  for (const path of paths) {
    const response = await page.request.get(`./${path}`)
    expect(response.status(), path).toBe(200)
    expect(Number(response.headers()['content-length'] ?? '0'), path).toBeGreaterThan(1000)
  }
})

test('가로 넘침이 없다', async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `오늘 화면 ${width}px`).toBeLessThanOrEqual(0)
  }
})
