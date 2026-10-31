// 학습 기록 백업. **녹음은 넣지 않는다** — 용량이 크고 다른 기기로 옮길 값이 없다.
// 문장도 넣지 않는다. 문장은 번들 코퍼스에서 다시 심어지고, 직접 고친 것만 따로 담는다.
import { z } from 'zod'
import type { DayLog, Review, Sentence, Settings } from '../../domain/types'

export const BACKUP_VERSION = 1

export interface Backup {
  app: 'gosay'
  version: number
  exportedAt: string
  reviews: readonly Review[]
  days: readonly DayLog[]
  settings: Settings
  /** 앱 안에서 직접 추가·수정한 문장만 */
  customSentences: readonly Sentence[]
}

const gradeSchema = z.enum(['stuck', 'shaky', 'fluent'])

const reviewSchema = z.object({
  sentenceId: z.string().min(1),
  due: z.string().min(1),
  interval: z.number(),
  ease: z.number(),
  streak: z.number(),
  lastGrade: gradeSchema.nullable(),
  stuckCount: z.number(),
  reviewedAt: z.string().nullable(),
})

const daySchema = z.object({ date: z.string().min(1), spoken: z.number(), stuck: z.number() })

const sentenceSchema = z.object({
  id: z.string().min(1),
  track: z.enum(['work', 'term', 'fix', 'small']),
  group: z.string(),
  ko: z.string(),
  en: z.string(),
  note: z.string(),
  source: z.string(),
  audio: z.string().nullable(),
  custom: z.boolean(),
})

const settingsSchema = z.object({
  id: z.literal('settings'),
  dailyCount: z.number().int().positive(),
  speed: z.number().positive(),
  theme: z.enum(['auto', 'light', 'dark']),
  catchUpCap: z.number().int().positive(),
  tracks: z.array(z.enum(['work', 'term', 'fix', 'small'])).min(1),
})

const backupSchema = z.object({
  app: z.literal('gosay'),
  version: z.number(),
  exportedAt: z.string(),
  reviews: z.array(reviewSchema),
  days: z.array(daySchema),
  settings: settingsSchema,
  customSentences: z.array(sentenceSchema).default([]),
})

export interface BackupInput {
  reviews: Readonly<Record<string, Review>>
  days: Readonly<Record<string, DayLog>>
  sentences: Readonly<Record<string, Sentence>>
  settings: Settings
  now: string
}

export function buildBackup(input: BackupInput): Backup {
  return {
    app: 'gosay',
    version: BACKUP_VERSION,
    exportedAt: input.now,
    reviews: Object.values(input.reviews),
    days: Object.values(input.days),
    settings: input.settings,
    customSentences: Object.values(input.sentences).filter((row) => row.custom),
  }
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; reason: string }

/** 가져온 파일을 검사한다. 남의 파일이나 깨진 파일로 학습 기록을 덮지 않으려는 것이다. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'JSON 파일이 아니에요' }
  }
  const parsed = backupSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, reason: `gosay 백업 파일이 아니에요 (${issue?.path.join('.') || '형식'})` }
  }
  if (parsed.data.version > BACKUP_VERSION) {
    return { ok: false, reason: '더 새로운 버전의 백업이에요. 앱을 먼저 갱신해 주세요' }
  }
  return { ok: true, backup: parsed.data as Backup }
}

export function backupFileName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `gosay-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`
}
