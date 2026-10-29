// 배포본 점검. **로컬 빌드가 아니라 배포된 주소**를 연다 —
// 서비스 워커·PWA·하위 경로(/gosay/) 문제는 배포본에서만 나온다.
//
// 실행: node scripts/check-live.mjs [주소]
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, devices } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'shots')
const base = process.argv[2] ?? 'https://kyeongseok-go.github.io/gosay/'

mkdirSync(outDir, { recursive: true })

const problems = []
const note = (line) => process.stdout.write(`${line}\n`)

const browser = await chromium.launch()
try {
  const context = await browser.newContext({
    ...devices['iPhone 14 Pro'],
    // 아이폰에서 실제로 쓰는 조건에 맞춘다. 녹음 권한은 미리 준다.
    permissions: ['microphone'],
  })
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  const failed = []
  page.on('requestfailed', (request) => failed.push(`${request.url()} — ${request.failure()?.errorText ?? ''}`))

  await page.goto(base, { waitUntil: 'networkidle' })

  const start = page.getByRole('button', { name: /오늘 연습 시작/ })
  await start.waitFor({ timeout: 15_000 })
  note(`오늘 화면 열림: ${await start.textContent()}`)
  await page.screenshot({ path: join(outDir, 'live-today.png') })

  await start.click()
  const beats = [
    ['듣기', '들었다, 다음'],
    ['겹쳐 말하기', '따라 말했다, 다음'],
    ['가린 채 말하기', '말했다, 들어 보기'],
  ]
  for (const [title, next] of beats) {
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    if (heading !== title) problems.push(`박자 제목이 '${title}' 이 아니라 '${heading}' 이에요`)
    note(`박자: ${heading}`)
    await page.screenshot({ path: join(outDir, `live-${title}.png`) })
    await page.getByRole('button', { name: next }).click()
  }

  const last = await page.getByRole('heading', { level: 1 }).textContent()
  note(`박자: ${last}`)
  await page.screenshot({ path: join(outDir, 'live-대조와 채점.png') })

  // 기준 음원을 실제로 받아 본다. 404 면 지하철에서 소리가 안 난다.
  // 재생 요소는 DOM 에 붙지 않으므로(usePlayer 가 new Audio() 로 만든다) 네트워크로 확인한다.
  await page.getByRole('button', { name: '기준 음원' }).click()
  await page.waitForTimeout(800)
  const index = JSON.parse(
    readFileSync(new URL('../src/content/audio-index.json', import.meta.url), 'utf8'),
  )
  const paths = Object.values(index)
  let bytes = 0
  for (const path of paths) {
    const response = await page.request.get(new URL(path, base).toString())
    if (!response.ok()) {
      problems.push(`음원을 받지 못했어요: ${path} (${response.status()})`)
      break
    }
    bytes += Number(response.headers()['content-length'] ?? '0')
  }
  note(`음원 ${paths.length}개 전부 200, 합계 ${(bytes / 1024 / 1024).toFixed(2)}MB`)

  await page.getByRole('button', { name: /바로 나왔다/ }).click()
  await page.waitForTimeout(400)
  const after = await page.getByRole('heading', { level: 1 }).textContent()
  if (after !== '듣기') problems.push(`채점 뒤 다음 카드로 가지 않았어요(지금 '${after}')`)
  note(`채점 뒤: ${after}`)

  // 중단 복원: 앱을 다시 여는 것과 같다.
  await page.goto(base, { waitUntil: 'networkidle' })
  const resume = page.getByRole('button', { name: /이어서 하기/ })
  if (!(await resume.isVisible())) problems.push('다시 열었을 때 이어서 하기가 없어요')
  else note(`중단 복원: ${await resume.textContent()}`)

  // 오프라인 재방문. 서비스 워커가 앱 셸과 음원을 쥐고 있어야 한다.
  // **미리 받기가 끝날 때까지 기다린다** — 끝나기 전에 끄면 당연히 안 열린다(실제 사용도 그렇다).
  const cached = await page.evaluate(async () => {
    for (let i = 0; i < 60; i += 1) {
      if (navigator.serviceWorker.controller) {
        const keys = await caches.keys()
        const precache = keys.find((key) => key.includes('precache'))
        if (precache) {
          const held = await (await caches.open(precache)).keys()
          if (held.length > 30) return held.length
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    return 0
  })
  if (cached === 0) problems.push('서비스 워커가 미리 받기를 끝내지 못했어요')
  else note(`미리 받기: ${cached}항목`)

  await context.setOffline(true)
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  const offlineOk = await page
    .getByRole('button', { name: /이어서 하기|오늘 연습 시작/ })
    .waitFor({ timeout: 15_000 })
    .then(() => true)
    .catch(() => false)
  if (!offlineOk) problems.push('네트워크를 끄면 앱이 열리지 않아요')
  else note('오프라인 재방문: 열림')
  await context.setOffline(false)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  if (overflow > 0) problems.push(`가로 넘침 ${overflow}px`)
  note(`가로 넘침: ${overflow}px`)

  if (errors.length > 0) problems.push(`콘솔 오류 ${errors.length}건: ${errors.slice(0, 3).join(' / ')}`)
  const realFailures = failed.filter((line) => !line.includes('favicon'))
  if (realFailures.length > 0) problems.push(`받지 못한 요청 ${realFailures.length}건: ${realFailures[0]}`)
  note(`콘솔 오류 ${errors.length}건, 받지 못한 요청 ${realFailures.length}건`)

  await context.close()
} finally {
  await browser.close()
}

if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`✗ ${problem}\n`)
  process.stderr.write(`\n배포본 점검 실패: ${problems.length}건\n`)
  process.exit(1)
}
note('\n배포본 점검 통과: 4박자·음원·중단 복원·오프라인 전부 동작')
