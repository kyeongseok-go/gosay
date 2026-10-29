// 손가락이 닿는 것이 44px 밑으로 내려가지 않는지 잰다(Apple HIG 최소 터치 영역).
// 추측하지 않고 실제로 그려진 상자를 잰다. 못 넓히는 것이 있으면 목록으로 남긴다.
//
// 실행: node scripts/check-taps.mjs
import { execFileSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4175
const base = `http://localhost:${PORT}`
const MIN = 44

/** 재 볼 화면. 세션은 네 박자를 다 지나며 잰다. */
const SCREENS = [
  { name: '오늘', path: '#/' },
  { name: '묶음', path: '#/tracks' },
  { name: '기록', path: '#/stats' },
  { name: '설정', path: '#/settings' },
  { name: '내 문장', path: '#/sentences' },
]

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // 아직 안 떴다
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`서버가 뜨지 않았어요: ${url}`)
}

/** 그려진 상자가 44px 미만인 누를 것들. 숨어 있는 것(sr-only)은 뺀다. */
async function smallTargets(page) {
  return page.evaluate((min) => {
    const nodes = [...document.querySelectorAll('button, a[href], input, textarea, select')]
    return nodes
      .filter((node) => !node.classList.contains('sr-only'))
      .map((node) => {
        const box = node.getBoundingClientRect()
        return {
          tag: node.tagName.toLowerCase(),
          cls: node.getAttribute('class') ?? '',
          text: (node.textContent ?? '').trim().slice(0, 20),
          w: Math.round(box.width),
          h: Math.round(box.height),
        }
      })
      .filter((row) => row.w > 0 && row.h > 0 && (row.w < min || row.h < min))
  }, MIN)
}

// 옛 빌드를 재면 고친 것이 반영되지 않는다. 늘 새로 빌드한 뒤에 잰다.
execFileSync('pnpm', ['build'], { cwd: root, stdio: 'ignore' })
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT)], { cwd: root, stdio: 'ignore' })
const browser = await chromium.launch()
const found = []
try {
  await waitFor(`${base}/`)
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()

  for (const screen of SCREENS) {
    await page.goto(`${base}/${screen.path}`)
    await page.waitForSelector('h1', { timeout: 15_000 })
    for (const row of await smallTargets(page)) found.push({ screen: screen.name, ...row })
  }

  // 세션 네 박자
  await page.goto(`${base}/`)
  await page.getByRole('button', { name: /오늘 연습 시작|이어서 하기/ }).click()
  for (const [beat, next] of [
    ['듣기', '들었다, 다음'],
    ['겹쳐 말하기', '따라 말했다, 다음'],
    ['가린 채 말하기', '말했다, 들어 보기'],
    ['대조와 채점', null],
  ]) {
    await page.waitForSelector('h1')
    for (const row of await smallTargets(page)) found.push({ screen: `세션 ${beat}`, ...row })
    if (next) await page.getByRole('button', { name: next }).click()
  }

  await context.close()
} finally {
  await browser.close()
  server.kill()
}

if (found.length === 0) {
  process.stdout.write(`터치 영역 검사 통과: ${MIN}px 미만이 한 곳도 없어요\n`)
} else {
  process.stdout.write(`${MIN}px 미만 ${found.length}곳:\n`)
  for (const row of found) {
    process.stdout.write(`  ${row.screen} · ${row.tag}.${row.cls.split(' ')[0]} "${row.text}" ${row.w}×${row.h}\n`)
  }
}
