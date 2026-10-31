import { describe, expect, test } from 'vitest'
import { BACKUP_VERSION, backupFileName, buildBackup, parseBackup } from './backup'
import { startingReview } from '../../domain/review'
import { defaultSettings } from '../../store/defaults'
import type { Sentence } from '../../domain/types'

function sentence(id: string, custom: boolean): Sentence {
  return {
    id,
    track: 'work',
    group: '경력 설명',
    ko: '한국어',
    en: 'english',
    note: '',
    source: '테스트',
    audio: null,
    custom,
  }
}

const input = {
  reviews: { s1: startingReview('s1', '2026-10-29') },
  days: { '2026-10-29': { date: '2026-10-29', spoken: 3, stuck: 1 } },
  sentences: { s1: sentence('s1', false), s2: sentence('s2', true) },
  settings: defaultSettings(),
  now: '2026-10-29T23:00:00.000Z',
}

describe('buildBackup', () => {
  test('복습·기록·설정을 담는다', () => {
    const backup = buildBackup(input)

    expect(backup.app).toBe('gosay')
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.reviews).toHaveLength(1)
    expect(backup.days).toHaveLength(1)
  })

  test('직접 고친 문장만 담는다 — 번들 문장은 코퍼스에서 다시 심어진다', () => {
    const backup = buildBackup(input)

    expect(backup.customSentences.map((row) => row.id)).toEqual(['s2'])
  })
})

describe('parseBackup', () => {
  test('내가 만든 백업을 다시 읽을 수 있다', () => {
    const text = JSON.stringify(buildBackup(input))

    const result = parseBackup(text)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.reviews[0].sentenceId).toBe('s1')
  })

  test('JSON 이 아니면 거절한다', () => {
    const result = parseBackup('이건 그냥 글')

    expect(result).toEqual({ ok: false, reason: 'JSON 파일이 아니에요' })
  })

  test('남의 앱 백업은 거절한다 — 학습 기록을 덮어쓰면 되돌릴 수 없다', () => {
    const result = parseBackup(JSON.stringify({ app: 'godo', version: 1, tasks: [] }))

    expect(result.ok).toBe(false)
  })

  test('필드가 빠지면 거절한다', () => {
    const broken = { ...buildBackup(input), settings: { id: 'settings' } }

    const result = parseBackup(JSON.stringify(broken))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('백업 파일이 아니에요')
  })

  test('더 새로운 버전은 거절한다', () => {
    const future = { ...buildBackup(input), version: BACKUP_VERSION + 1 }

    const result = parseBackup(JSON.stringify(future))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('새로운 버전')
  })

  test('직접 고친 문장이 없는 옛 백업도 읽는다', () => {
    const { customSentences, ...older } = buildBackup(input)
    void customSentences

    const result = parseBackup(JSON.stringify(older))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.backup.customSentences).toEqual([])
  })
})

describe('backupFileName', () => {
  test('날짜가 붙은 이름이다', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('gosay-20261005.json')
  })
})
