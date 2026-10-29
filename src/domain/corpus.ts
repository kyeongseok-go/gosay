// 코퍼스: 번들에 들어가는 문장 목록. `src/content/*.json` 이 원천이고, 이 파일이 Sentence 로 바꾼다.
//
// 콘텐츠가 이 앱의 제품이다. 그래서 형식을 런타임에 검사한다 — 손으로 고치다 필드를 빠뜨리면
// 화면에서 조용히 빈칸이 되는 대신 여기서 바로 터지게 한다.
import { z } from 'zod'
import interview from '../content/interview.json'
import recovery from '../content/recovery.json'
import audioIndex from '../content/audio-index.json'
import { TRACKS } from './types'
import type { Sentence } from './types'

const sentenceSchema = z.object({
  id: z.string().min(1),
  track: z.enum(TRACKS as unknown as [string, ...string[]]),
  group: z.string().min(1),
  ko: z.string().min(1),
  en: z.string().min(1),
  note: z.string(),
  source: z.string().min(1),
})

const fileSchema = z.object({ note: z.string(), sentences: z.array(sentenceSchema).min(1) })

/** 영어 문장 → 번들된 음원 경로. 색인은 `scripts/make-audio.mjs` 가 쓴다. */
const audioOf: Readonly<Record<string, string>> = audioIndex

function load(raw: unknown, file: string): Sentence[] {
  const parsed = fileSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`${file} 의 형식이 계약과 달라요: ${parsed.error.issues[0]?.message ?? '알 수 없음'}`)
  }
  return parsed.data.sentences.map((row) => ({
    ...row,
    track: row.track as Sentence['track'],
    // 음원이 없으면 null 로 둔다. 앱은 런타임 TTS 로 대체하고 그 사실을 화면에 알린다.
    audio: audioOf[row.en] ?? null,
    custom: false,
  }))
}

/** 번들된 전 문장. 면접 트랙이 먼저 온다. */
export function corpus(): Sentence[] {
  return [...load(interview, 'interview.json'), ...load(recovery, 'recovery.json')]
}

/** 음원이 붙지 않은 문장의 영어. 0 이 아니면 `pnpm audio` 를 다시 돌려야 한다. */
export function missingAudio(sentences: readonly Sentence[]): string[] {
  return sentences.filter((s) => s.audio === null && !s.custom).map((s) => s.en)
}
