import { describe, expect, test } from 'vitest'
import { groupRows } from './groupRows'
import { startingReview } from '../../domain/review'
import type { Review, Sentence } from '../../domain/types'

function sentence(id: string, group: string): Sentence {
  return {
    id,
    track: 'work',
    group,
    ko: '한국어',
    en: 'english',
    note: '',
    source: '테스트',
    audio: null,
    custom: false,
  }
}

function reviewsOf(...rows: Review[]): Record<string, Review> {
  return Object.fromEntries(rows.map((row) => [row.sentenceId, row]))
}

const TODAY = '2026-10-29'
const SENTENCES = [sentence('a', '자기소개'), sentence('b', '자기소개'), sentence('c', '역질문')]

describe('groupRows', () => {
  test('묶음별로 장수를 센다', () => {
    const rows = groupRows(SENTENCES, {}, TODAY)

    // 아직 아무것도 안 했으면 대기 수가 곧 장수라, 큰 묶음이 먼저 온다.
    expect(rows.map((row) => [row.group, row.total])).toEqual([
      ['자기소개', 2],
      ['역질문', 1],
    ])
  })

  test('한 번도 안 한 문장은 전부 대기다', () => {
    const rows = groupRows(SENTENCES, {}, TODAY)

    expect(rows.every((row) => row.due === row.total)).toBe(true)
  })

  test("'바로 나왔다' 를 받은 문장만 익힌 것으로 센다", () => {
    const reviews = reviewsOf(
      { ...startingReview('a', TODAY), due: '2026-11-05', streak: 2 },
      { ...startingReview('b', TODAY), due: '2026-11-05', streak: 0, lastGrade: 'shaky' },
    )

    const rows = groupRows(SENTENCES, reviews, TODAY)
    const intro = rows.find((row) => row.group === '자기소개')

    expect(intro?.solid).toBe(1)
    expect(intro?.due).toBe(0)
  })

  test('대기가 많은 묶음이 먼저 온다 — 지금 할 것이 위에 있어야 한다', () => {
    const reviews = reviewsOf({ ...startingReview('c', TODAY), due: '2026-11-05', streak: 1 })

    const rows = groupRows(SENTENCES, reviews, TODAY)

    expect(rows[0].group).toBe('자기소개')
  })

  test('문장이 없으면 빈 목록이다', () => {
    expect(groupRows([], {}, TODAY)).toEqual([])
  })
})
