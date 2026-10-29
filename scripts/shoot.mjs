// 스크린샷. 에이전트가 자기 화면을 한 번도 안 보고 끝내는 것을 막는 장치다.
// **저장소 안에 둔다** — 스크래치패드에 두면 다음 세션에서 사라진다.
//
// 실행: node scripts/shoot.mjs            (dev 서버를 띄워서 찍는다)
//       node scripts/shoot.mjs --preview  (프로덕션 빌드를 preview 로 띄워서 찍는다)
//       node scripts/shoot.mjs --url https://... (배포본을 찍는다)
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'shots')

const args = process.argv.slice(2)
const usePreview = args.includes('--preview')
const urlIndex = args.indexOf('--url')
const remote = urlIndex >= 0 ? args[urlIndex + 1] : null

const PORT = usePreview ? 4174 : 5174
const base = remote ?? `http://localhost:${PORT}`

/** 찍을 화면. 배포본에는 seed 가 없으므로 seed 가 필요한 것은 로컬에서만 찍는다. */
const SHOTS = [
  { file: 'today-1440', path: '#/', width: 1440, height: 900, dark: false, seed: { due: 5, days: 4 } },
  { file: 'today-768', path: '#/', width: 768, height: 1024, dark: false, seed: { due: 5, days: 4 } },
  { file: 'today-390', path: '#/', width: 390, height: 844, dark: false, seed: { due: 5, days: 4 } },
  { file: 'today-390-dark', path: '#/', width: 390, height: 844, dark: true, seed: { due: 5, days: 4 } },
  {
    file: 'session-listen-390',
    path: '#/session',
    width: 390,
    height: 844,
    dark: false,
    seed: { due: 5, days: 4, startSession: true },
  },
  {
    file: 'session-produce-390',
    path: '#/session',
    width: 390,
    height: 844,
    dark: false,
    seed: { due: 5, days: 4, midSession: true },
  },
  {
    file: 'session-produce-390-dark',
    path: '#/session',
    width: 390,
    height: 844,
    dark: true,
    seed: { due: 5, days: 4, midSession: true },
  },
  { file: 'tracks-390', path: '#/tracks', width: 390, height: 844, dark: false, seed: { due: 5, days: 4 } },
  { file: 'stats-390', path: '#/stats', width: 390, height: 844, dark: false, seed: { due: 5, days: 4 } },
  { file: 'stats-390-dark', path: '#/stats', width: 390, height: 844, dark: true, seed: { due: 5, days: 4 } },
  { file: 'settings-390', path: '#/settings', width: 390, height: 844, dark: false, seed: { due: 5, days: 4 } },
  { file: 'sentences-390', path: '#/sentences', width: 390, height: 844, dark: false, seed: { due: 5, days: 4 } },
  { file: 'settings-390-dark', path: '#/settings', width: 390, height: 844, dark: true, seed: { due: 5, days: 4 } },
  {
    file: 'session-1440',
    path: '#/session',
    width: 1440,
    height: 900,
    dark: false,
    seed: { due: 5, days: 4, startSession: true },
  },
]

function serve() {
  const command = usePreview ? ['exec', 'vite', 'preview', '--port', String(PORT)] : ['exec', 'vite', '--port', String(PORT)]
  const child = spawn('pnpm', command, { cwd: root, stdio: 'ignore' })
  return child
}

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // 아직 안 떴다
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`서버가 뜨지 않았어요: ${url}`)
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const server = remote ? null : serve()
const browser = await chromium.launch()
try {
  if (!remote) await waitFor(`${base}/`)

  for (const shot of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      colorScheme: shot.dark ? 'dark' : 'light',
      deviceScaleFactor: 2,
      // 녹음 권한을 미리 주면 3박자 화면이 실제 상태로 찍힌다.
      permissions: ['microphone'],
    })
    const page = await context.newPage()
    await page.goto(`${base}/`)
    if (shot.seed && !remote) {
      await page.waitForFunction('window.__gosay !== undefined')
      await page.evaluate((options) => window.__gosay.seedDemo(options), shot.seed)
    }
    await page.goto(`${base}/${shot.path}`)
    await page.waitForLoadState('networkidle')
    // 들어오는 전환(--duration-normal 320ms)이 끝난 뒤를 찍는다.
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(outDir, `${shot.file}.png`) })
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    process.stdout.write(`${shot.file}.png  ${shot.width}×${shot.height}  가로 넘침 ${overflow}px\n`)
    await context.close()
  }
} finally {
  await browser.close()
  server?.kill()
}
