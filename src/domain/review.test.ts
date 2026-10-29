import { describe, expect, test } from 'vitest'
import { EASE_FLOOR, EASE_CEILING, MAX_INTERVAL, dueOn, nextReview, startingReview } from './review'
import type { Review } from './types'

/** 테스트에서 읽기 쉬운 복습 행을 만든다. */
function review(patch: Partial<Review> = {}): Review {
  return {
    sentenceId: 's1',
    due: '2026-10-29',
    interval: 4,
    ease: 2,
    streak: 2,
    lastGrade: 'fluent',
    stuckCount: 0,
    reviewedAt: '2026-10-25',
    ...patch,
  }
}

describe('startingReview', () => {
  test('아직 한 번도 안 한 문장은 오늘이 복습일이다', () => {
    const fresh = startingReview('s1', '2026-10-29')

    expect(fresh.due).toBe('2026-10-29')
    expect(fresh.interval).toBe(0)
    expect(fresh.streak).toBe(0)
    expect(fresh.lastGrade).toBeNull()
    expect(fresh.reviewedAt).toBeNull()
  })
})

describe('nextReview — 바로 나왔다', () => {
  test('간격이 ease 배로 멀어진다', () => {
    const next = nextReview(review({ interval: 4, ease: 2 }), 'fluent', '2026-10-29')

    expect(next.interval).toBe(8)
    expect(next.due).toBe('2026-11-06')
    expect(next.streak).toBe(3)
    expect(next.lastGrade).toBe('fluent')
    expect(next.reviewedAt).toBe('2026-10-29')
  })

  test('처음 만나 바로 나온 문장은 이틀 뒤에 다시 본다', () => {
    const next = nextReview(startingReview('s1', '2026-10-29'), 'fluent', '2026-10-29')

    expect(next.interval).toBe(2)
    expect(next.due).toBe('2026-10-31')
  })

  test('ease 가 올라가지만 천장을 넘지 않는다', () => {
    const next = nextReview(review({ ease: EASE_CEILING }), 'fluent', '2026-10-29')

    expect(next.ease).toBe(EASE_CEILING)
  })

  test('간격은 상한에서 멈춘다 — 면접 준비에 반년 뒤 일정은 뜻이 없다', () => {
    const next = nextReview(review({ interval: MAX_INTERVAL, ease: 2.5 }), 'fluent', '2026-10-29')

    expect(next.interval).toBe(MAX_INTERVAL)
  })
})

describe('nextReview — 더듬었다', () => {
  test('간격은 그대로 두고 ease 만 깎는다', () => {
    const next = nextReview(review({ interval: 4, ease: 2 }), 'shaky', '2026-10-29')

    expect(next.interval).toBe(4)
    expect(next.due).toBe('2026-11-02')
    expect(next.ease).toBeCloseTo(1.85)
    expect(next.streak).toBe(0)
  })

  test('처음 만난 문장을 더듬었으면 내일 다시 본다', () => {
    const next = nextReview(startingReview('s1', '2026-10-29'), 'shaky', '2026-10-29')

    expect(next.interval).toBe(1)
    expect(next.due).toBe('2026-10-30')
  })
})

describe('nextReview — 막혔다', () => {
  test('간격이 초기화되고 오늘 안에 다시 나온다', () => {
    const next = nextReview(review({ interval: 20, ease: 2.4, streak: 5 }), 'stuck', '2026-10-29')

    expect(next.interval).toBe(0)
    expect(next.due).toBe('2026-10-29')
    expect(next.streak).toBe(0)
    expect(next.stuckCount).toBe(1)
  })

  test('막힘이 쌓이면 누적 횟수가 늘어난다 — 약점 목록의 근거다', () => {
    const once = nextReview(review({ stuckCount: 3 }), 'stuck', '2026-10-29')

    expect(once.stuckCount).toBe(4)
  })

  test('ease 는 바닥 밑으로 내려가지 않는다', () => {
    const next = nextReview(review({ ease: EASE_FLOOR }), 'stuck', '2026-10-29')

    expect(next.ease).toBe(EASE_FLOOR)
  })
})

describe('dueOn', () => {
  test('복습일이 오늘이거나 지났으면 대상이다', () => {
    expect(dueOn(review({ due: '2026-10-28' }), '2026-10-29')).toBe(true)
    expect(dueOn(review({ due: '2026-10-29' }), '2026-10-29')).toBe(true)
    expect(dueOn(review({ due: '2026-10-30' }), '2026-10-29')).toBe(false)
  })

  test('복습 기록이 없는 문장도 대상이다', () => {
    expect(dueOn(undefined, '2026-10-29')).toBe(true)
  })
})
