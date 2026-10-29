import { describe, expect, test } from 'vitest'
import {
  applyChangeSet,
  emptyEntityState,
  isEmptyChangeSet,
  keyOf,
  mergeChangeSets,
} from './changes'
import type { ChangeSet } from './changes'
import { startingReview } from '../domain/review'
import type { DayLog, Sentence } from '../domain/types'

function sentence(id: string, ko = '한국어'): Sentence {
  return {
    id,
    track: 'interview',
    group: '경력 설명',
    ko,
    en: 'english',
    note: '',
    source: '테스트',
    audio: null,
    custom: false,
  }
}

const day: DayLog = { date: '2026-10-29', spoken: 3, stuck: 1 }

describe('keyOf', () => {
  test('테이블마다 키 필드가 다르다', () => {
    expect(keyOf('sentences', sentence('s1'))).toBe('s1')
    expect(keyOf('reviews', startingReview('s1', '2026-10-29'))).toBe('s1')
    expect(keyOf('days', day)).toBe('2026-10-29')
  })
})

describe('isEmptyChangeSet', () => {
  test('아무것도 없으면 비어 있다', () => {
    expect(isEmptyChangeSet({ puts: {}, deletes: {} })).toBe(true)
    expect(isEmptyChangeSet({ puts: { sentences: [] }, deletes: {} })).toBe(true)
    expect(isEmptyChangeSet({ puts: { sentences: [sentence('s1')] }, deletes: {} })).toBe(false)
    expect(isEmptyChangeSet({ puts: {}, deletes: { sentences: ['s1'] } })).toBe(false)
  })
})

describe('applyChangeSet', () => {
  test('넣기와 지우기가 함께 반영된다', () => {
    const base = applyChangeSet(emptyEntityState(), {
      puts: { sentences: [sentence('s1'), sentence('s2')] },
      deletes: {},
    })

    const next = applyChangeSet(base, { puts: { sentences: [sentence('s3')] }, deletes: { sentences: ['s1'] } })

    expect(Object.keys(next.sentences).sort()).toEqual(['s2', 's3'])
  })

  test('원본을 건드리지 않는다', () => {
    const base = applyChangeSet(emptyEntityState(), { puts: { sentences: [sentence('s1')] }, deletes: {} })

    applyChangeSet(base, { puts: { sentences: [sentence('s1', '바뀐 한국어')] }, deletes: {} })

    expect(base.sentences.s1.ko).toBe('한국어')
  })

  test('손대지 않은 테이블은 같은 객체로 남는다', () => {
    const base = applyChangeSet(emptyEntityState(), { puts: { days: [day] }, deletes: {} })

    const next = applyChangeSet(base, { puts: { sentences: [sentence('s1')] }, deletes: {} })

    expect(next.days).toBe(base.days)
  })

  test('없는 행을 지워도 터지지 않는다', () => {
    const next = applyChangeSet(emptyEntityState(), { puts: {}, deletes: { sentences: ['없음'] } })

    expect(next.sentences).toEqual({})
  })
})

describe('mergeChangeSets', () => {
  test('나중 것이 앞선 것을 덮는다', () => {
    const merged = mergeChangeSets(
      { puts: { sentences: [sentence('s1', '먼저')] }, deletes: {} },
      { puts: { sentences: [sentence('s1', '나중')] }, deletes: {} },
    )

    expect(merged.puts.sentences).toHaveLength(1)
    expect(merged.puts.sentences?.[0].ko).toBe('나중')
  })

  test('넣었다가 지우면 지우기만 남는다', () => {
    const merged = mergeChangeSets(
      { puts: { sentences: [sentence('s1')] }, deletes: {} },
      { puts: {}, deletes: { sentences: ['s1'] } },
    )

    expect(merged.puts.sentences).toBeUndefined()
    expect(merged.deletes.sentences).toEqual(['s1'])
  })

  test('지웠다가 다시 넣으면 넣기만 남는다', () => {
    const merged = mergeChangeSets(
      { puts: {}, deletes: { sentences: ['s1'] } },
      { puts: { sentences: [sentence('s1')] }, deletes: {} },
    )

    expect(merged.deletes.sentences).toBeUndefined()
    expect(merged.puts.sentences).toHaveLength(1)
  })

  test('서로 다른 테이블은 그대로 모인다', () => {
    const merged = mergeChangeSets(
      { puts: { sentences: [sentence('s1')] }, deletes: {} },
      { puts: { days: [day] }, deletes: {} },
    )

    expect(merged.puts.sentences).toHaveLength(1)
    expect(merged.puts.days).toHaveLength(1)
  })

  test('아무것도 합치지 않으면 빈 변경이다', () => {
    const merged: ChangeSet = mergeChangeSets()

    expect(isEmptyChangeSet(merged)).toBe(true)
  })
})
