import { describe, expect, test } from 'vitest'
import {
  advanceBeat,
  buildSession,
  currentSentenceId,
  isFinished,
  spokenCount,
  stuckIds,
  submitGrade,
} from './session'
import { startingReview } from './review'
import type { Review, Sentence, Session, Track } from './types'

function sentence(id: string, track: Track = 'work'): Sentence {
  return {
    id,
    track,
    group: '경력 설명',
    ko: `한국어 ${id}`,
    en: `english ${id}`,
    note: '',
    source: '테스트',
    audio: `audio/${id}.m4a`,
    custom: false,
  }
}

function reviewsOf(...rows: Review[]): Record<string, Review> {
  return Object.fromEntries(rows.map((row) => [row.sentenceId, row]))
}

const TODAY = '2026-10-29'

function build(partial: Partial<Parameters<typeof buildSession>[0]> = {}): Session {
  return buildSession({
    id: 'sess-1',
    today: TODAY,
    startedAt: '2026-10-29T08:00:00.000Z',
    sentences: [sentence('a'), sentence('b'), sentence('c')],
    reviews: {},
    dailyCount: 10,
    catchUpCap: 20,
    tracks: ['work'],
    ...partial,
  })
}

describe('buildSession', () => {
  test('처음 쓸 때는 신규 문장으로 채운다', () => {
    const session = build()

    expect(session.sentenceIds).toEqual(['a', 'b', 'c'])
    expect(session.index).toBe(0)
    expect(session.beat).toBe('listen')
    expect(session.finishedAt).toBeNull()
  })

  test('하루 분량을 넘기지 않는다', () => {
    const session = build({ dailyCount: 2 })

    expect(session.sentenceIds).toHaveLength(2)
  })

  test('복습 예정이 신규보다 먼저 온다', () => {
    const session = build({
      reviews: reviewsOf({ ...startingReview('c', TODAY), due: '2026-10-20', reviewedAt: '2026-10-19' }),
    })

    expect(session.sentenceIds[0]).toBe('c')
  })

  test('복습 예정끼리는 더 오래 밀린 것이 먼저다', () => {
    const session = build({
      reviews: reviewsOf(
        { ...startingReview('a', TODAY), due: '2026-10-25', reviewedAt: '2026-10-24' },
        { ...startingReview('b', TODAY), due: '2026-10-20', reviewedAt: '2026-10-19' },
      ),
    })

    expect(session.sentenceIds.slice(0, 2)).toEqual(['b', 'a'])
  })

  test('같은 날 밀린 것 중에서는 많이 막혔던 문장이 먼저다', () => {
    const session = build({
      reviews: reviewsOf(
        { ...startingReview('a', TODAY), due: '2026-10-20', reviewedAt: '2026-10-19', stuckCount: 1 },
        { ...startingReview('b', TODAY), due: '2026-10-20', reviewedAt: '2026-10-19', stuckCount: 5 },
      ),
    })

    expect(session.sentenceIds.slice(0, 2)).toEqual(['b', 'a'])
  })

  test('아직 복습일이 안 된 문장은 넣지 않는다', () => {
    const session = build({
      sentences: [sentence('a')],
      reviews: reviewsOf({ ...startingReview('a', TODAY), due: '2026-11-05', reviewedAt: TODAY }),
    })

    expect(session.sentenceIds).toEqual([])
  })

  test('밀린 복습이 몰려도 상한에서 끊는다 — 100장이 몰려 포기하지 않게', () => {
    const many = Array.from({ length: 40 }, (_, i) => sentence(`s${i}`))
    const piled = many.map((s) => ({ ...startingReview(s.id, TODAY), due: '2026-10-01', reviewedAt: '2026-09-30' }))

    const session = build({ sentences: many, reviews: reviewsOf(...piled), dailyCount: 30, catchUpCap: 12 })

    expect(session.sentenceIds).toHaveLength(12)
  })

  test('고르지 않은 트랙은 넣지 않는다', () => {
    const session = build({
      sentences: [sentence('a', 'work'), sentence('s', 'small')],
      tracks: ['work'],
    })

    expect(session.sentenceIds).toEqual(['a'])
  })

  test('신규는 트랙을 돌아가며 뽑는다 — 두꺼운 묶음 하나에 한 주가 묶이지 않게', () => {
    const many = [
      ...Array.from({ length: 10 }, (_, i) => sentence(`w${i}`, 'work')),
      ...Array.from({ length: 10 }, (_, i) => sentence(`t${i}`, 'term')),
      ...Array.from({ length: 10 }, (_, i) => sentence(`f${i}`, 'fix')),
    ]

    const session = build({ sentences: many, tracks: ['work', 'term', 'fix'], dailyCount: 6 })

    expect(session.sentenceIds).toEqual(['w0', 't0', 'f0', 'w1', 't1', 'f1'])
  })

  test('한 트랙이 먼저 비어도 남은 트랙으로 채운다', () => {
    const session = build({
      sentences: [sentence('w0', 'work'), sentence('t0', 'term'), sentence('t1', 'term')],
      tracks: ['work', 'term'],
      dailyCount: 5,
    })

    expect(session.sentenceIds).toEqual(['w0', 't0', 't1'])
  })

  test('문장이 하나도 없으면 빈 세션이 나온다', () => {
    const session = build({ sentences: [] })

    expect(session.sentenceIds).toEqual([])
    expect(isFinished(session)).toBe(true)
  })
})

describe('advanceBeat', () => {
  test('네 박자를 순서대로 지난다', () => {
    const listen = build()
    const shadow = advanceBeat(listen)
    const produce = advanceBeat(shadow)
    const compare = advanceBeat(produce)

    expect([shadow.beat, produce.beat, compare.beat]).toEqual(['shadow', 'produce', 'compare'])
    expect(compare.index).toBe(0)
  })

  test('마지막 박자에서는 더 가지 않는다 — 채점이 카드를 넘긴다', () => {
    const compare = advanceBeat(advanceBeat(advanceBeat(build())))

    expect(advanceBeat(compare)).toBe(compare)
  })
})

describe('submitGrade', () => {
  test('채점하면 다음 카드의 첫 박자로 간다', () => {
    const next = submitGrade(build(), 'fluent', '2026-10-29T08:02:00.000Z')

    expect(next.index).toBe(1)
    expect(next.beat).toBe('listen')
    expect(next.grades).toEqual({ a: 'fluent' })
  })

  test('막힌 문장은 같은 세션 안에서 다시 나온다', () => {
    const next = submitGrade(build(), 'stuck', '2026-10-29T08:02:00.000Z')

    expect(next.sentenceIds).toEqual(['a', 'b', 'c', 'a'])
  })

  test('같은 문장을 두 번 다시 넣지 않는다 — 끝나지 않는 세션을 막는다', () => {
    const once = submitGrade(build(), 'stuck', '2026-10-29T08:02:00.000Z')
    const atRequeued = { ...once, index: 3 }
    const twice = submitGrade(atRequeued, 'stuck', '2026-10-29T08:05:00.000Z')

    expect(twice.sentenceIds).toEqual(['a', 'b', 'c', 'a'])
    expect(isFinished(twice)).toBe(true)
  })

  test('마지막 카드를 채점하면 세션이 끝난다', () => {
    const session = { ...build(), index: 2 }
    const done = submitGrade(session, 'fluent', '2026-10-29T08:10:00.000Z')

    expect(isFinished(done)).toBe(true)
    expect(done.finishedAt).toBe('2026-10-29T08:10:00.000Z')
  })

  test('다시 채점하면 마지막 값이 남는다', () => {
    const first = submitGrade(build(), 'stuck', '2026-10-29T08:02:00.000Z')
    const again = submitGrade({ ...first, index: 3 }, 'fluent', '2026-10-29T08:06:00.000Z')

    expect(again.grades.a).toBe('fluent')
  })
})

describe('읽기 함수', () => {
  test('currentSentenceId 는 지금 카드를 가리키고, 끝나면 없다', () => {
    const session = build()

    expect(currentSentenceId(session)).toBe('a')
    expect(currentSentenceId({ ...session, index: 3 })).toBeNull()
  })

  test('spokenCount 는 채점한 문장 수다', () => {
    const session = { ...build(), grades: { a: 'fluent', b: 'stuck' } } as Session

    expect(spokenCount(session)).toBe(2)
  })

  test('stuckIds 는 막힌 문장만 모은다', () => {
    const session = { ...build(), grades: { a: 'fluent', b: 'stuck', c: 'shaky' } } as Session

    expect(stuckIds(session)).toEqual(['b'])
  })
})
