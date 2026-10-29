// 코퍼스의 영어 문장을 맥 내장 음성으로 읽어 m4a 로 만든다.
// API 키·네트워크·가입이 전부 필요 없고, 번들해 두면 설치한 PWA 에서 완전히 오프라인으로 돈다.
// 파일명은 영어 문장의 해시다(내용 주소). 문장을 고치면 새 파일이 생기고, 안 고치면 건너뛴다.
//
// 실행: node scripts/make-audio.mjs [--voice Samantha] [--force]
// 선행: macOS (say, afconvert 는 /usr/bin 에 기본 설치)
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'src', 'content')
const outDir = join(root, 'public', 'audio')

/** 24kbps 모노 AAC. 실측: 3.8초 문장이 약 16KB. 300문장이면 4.6MB. */
const BITRATE = '24000'
const DEFAULT_VOICE = 'Samantha'
const INDEX_FILE = 'audio-index.json'

const args = process.argv.slice(2)
const force = args.includes('--force')
const voiceIndex = args.indexOf('--voice')
const voice = voiceIndex >= 0 ? args[voiceIndex + 1] : DEFAULT_VOICE

/** 영어 문장 → 파일명. 문장이 그대로면 같은 이름이 나온다. */
export function audioName(english) {
  return `${createHash('sha1').update(english.trim()).digest('hex').slice(0, 10)}.m4a`
}

function sentences() {
  if (!existsSync(contentDir)) throw new Error(`코퍼스 폴더가 없어요: ${contentDir}`)
  // audio-index.json 은 이 스크립트가 쓰는 산출물이다. 코퍼스로 다시 읽지 않는다.
  const files = readdirSync(contentDir).filter((name) => name.endsWith('.json') && name !== INDEX_FILE)
  if (files.length === 0) throw new Error(`${contentDir} 에 코퍼스 JSON 이 없어요`)
  return files.flatMap((name) => {
    const parsed = JSON.parse(readFileSync(join(contentDir, name), 'utf8'))
    const list = Array.isArray(parsed) ? parsed : parsed.sentences
    if (!Array.isArray(list)) throw new Error(`${name} 의 형식이 배열이 아니에요`)
    return list.map((item, index) => {
      if (typeof item.en !== 'string' || item.en.trim() === '') {
        throw new Error(`${name} 의 ${index}번 문장에 en 이 없어요`)
      }
      return item.en
    })
  })
}

function render(english, target) {
  const raw = `${target}.aiff`
  try {
    execFileSync('say', ['-v', voice, '-o', raw, english], { stdio: 'pipe' })
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', BITRATE, '-c', '1', raw, target], { stdio: 'pipe' })
  } finally {
    rmSync(raw, { force: true })
  }
}

const all = sentences()
const wanted = new Map(all.map((english) => [audioName(english), english]))
mkdirSync(outDir, { recursive: true })

let made = 0
let skipped = 0
for (const [name, english] of wanted) {
  const target = join(outDir, name)
  if (!force && existsSync(target)) {
    skipped += 1
    continue
  }
  render(english, target)
  made += 1
}

// 문장을 고치거나 지우면 쓰이지 않는 음원이 남는다. 번들 용량이 조용히 늘지 않게 치운다.
const orphans = readdirSync(outDir).filter((name) => name.endsWith('.m4a') && !wanted.has(name))
for (const name of orphans) rmSync(join(outDir, name))

// 앱이 문장 → 파일명을 런타임에 다시 계산하지 않도록 색인을 남긴다.
// 색인은 소스로 두고(번들에 들어간다), m4a 만 정적 자산으로 둔다.
// 런타임에 해시를 계산하려면 crypto.subtle 이 필요하고 그건 비동기라 첫 재생이 늦어진다.
const index = Object.fromEntries([...wanted].map(([name, english]) => [english, `audio/${name}`]))
writeFileSync(join(contentDir, INDEX_FILE), `${JSON.stringify(index, null, 2)}\n`)

const bytes = readdirSync(outDir)
  .filter((name) => name.endsWith('.m4a'))
  .reduce((sum, name) => sum + readFileSync(join(outDir, name)).length, 0)

process.stdout.write(
  `음원 ${wanted.size}개 (새로 만든 것 ${made}, 건너뛴 것 ${skipped}, 치운 것 ${orphans.length}), ` +
    `총 ${(bytes / 1024 / 1024).toFixed(2)}MB, 음성 ${voice}\n`,
)
