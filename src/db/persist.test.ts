import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { GosayDB } from './db'
import {
  RECORDINGS_PER_SENTENCE,
  clearProgress,
  latestRecording,
  loadAll,
  persistChanges,
  persistSettings,
  saveRecording,
} from './persist'
import { defaultSettings } from '../store/defaults'
import { startingReview } from '../domain/review'
import type { Recording, Sentence } from '../domain/types'

function sentence(id: string): Sentence {
  return {
    id,
    track: 'work',
    group: '경력 설명',
    ko: '한국어',
    en: 'english',
    note: '',
    source: '테스트',
    audio: null,
    custom: false,
  }
}

function recording(sentenceId: string, createdAt: number): Recording {
  return {
    id: `${sentenceId}:${createdAt}`,
    sentenceId,
    blob: new Blob(['소리'], { type: 'audio/mp4' }),
    mime: 'audio/mp4',
    createdAt,
  }
}

let db: GosayDB

beforeEach(() => {
  db = new GosayDB(`test-${Math.random().toString(36).slice(2)}`)
})

afterEach(async () => {
  await db.delete()
})

describe('loadAll / persistChanges', () => {
  test('빈 DB 는 빈 상태를 돌려준다', async () => {
    const loaded = await loadAll(db)

    expect(loaded.entities.sentences).toEqual({})
    expect(loaded.settings).toBeNull()
  })

  test('테이블마다 맞는 키로 담긴다', async () => {
    await persistChanges(db, {
      puts: {
        sentences: [sentence('s1')],
        reviews: [startingReview('s1', '2026-10-29')],
        days: [{ date: '2026-10-29', spoken: 2, stuck: 1 }],
      },
      deletes: {},
    })

    const loaded = await loadAll(db)

    expect(loaded.entities.sentences.s1.id).toBe('s1')
    expect(loaded.entities.reviews.s1.due).toBe('2026-10-29')
    expect(loaded.entities.days['2026-10-29'].spoken).toBe(2)
  })

  test('빈 변경은 트랜잭션을 열지 않는다', async () => {
    await expect(persistChanges(db, { puts: {}, deletes: {} })).resolves.toBeUndefined()
  })

  test('지우기가 반영된다', async () => {
    await persistChanges(db, { puts: { sentences: [sentence('s1'), sentence('s2')] }, deletes: {} })
    await persistChanges(db, { puts: {}, deletes: { sentences: ['s1'] } })

    const loaded = await loadAll(db)

    expect(Object.keys(loaded.entities.sentences)).toEqual(['s2'])
  })

  test('설정은 한 행으로 저장된다', async () => {
    await persistSettings(db, { ...defaultSettings(), dailyCount: 5 })
    await persistSettings(db, { ...defaultSettings(), dailyCount: 6 })

    const loaded = await loadAll(db)

    expect(loaded.settings?.dailyCount).toBe(6)
    expect(await db.settings.count()).toBe(1)
  })
})

describe('saveRecording', () => {
  test('녹음이 저장되고 최근 것을 찾을 수 있다', async () => {
    await saveRecording(db, recording('s1', 100))
    await saveRecording(db, recording('s1', 200))

    const latest = await latestRecording(db, 's1')

    expect(latest?.createdAt).toBe(200)
  })

  test('문장마다 최근 3개만 남는다 — 그냥 쌓으면 수십 MB 로 자란다', async () => {
    for (const at of [1, 2, 3, 4, 5]) await saveRecording(db, recording('s1', at))

    const mine = await db.recordings.where('sentenceId').equals('s1').toArray()

    expect(mine).toHaveLength(RECORDINGS_PER_SENTENCE)
    expect(mine.map((row) => row.createdAt).sort((a, b) => a - b)).toEqual([3, 4, 5])
  })

  test('다른 문장의 녹음은 건드리지 않는다', async () => {
    await saveRecording(db, recording('s1', 1))
    for (const at of [1, 2, 3, 4, 5]) await saveRecording(db, recording('s2', at))

    expect(await db.recordings.where('sentenceId').equals('s1').count()).toBe(1)
  })

  test('녹음이 없는 문장은 null 이다', async () => {
    expect(await latestRecording(db, '없음')).toBeNull()
  })
})

describe('clearProgress', () => {
  test('학습 기록만 지우고 문장은 남긴다', async () => {
    await persistChanges(db, {
      puts: {
        sentences: [sentence('s1')],
        reviews: [startingReview('s1', '2026-10-29')],
        days: [{ date: '2026-10-29', spoken: 1, stuck: 0 }],
      },
      deletes: {},
    })
    await saveRecording(db, recording('s1', 1))

    await clearProgress(db)

    const loaded = await loadAll(db)
    expect(Object.keys(loaded.entities.sentences)).toEqual(['s1'])
    expect(loaded.entities.reviews).toEqual({})
    expect(loaded.entities.days).toEqual({})
    expect(await db.recordings.count()).toBe(0)
  })
})
