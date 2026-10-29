import { describe, expect, test } from 'vitest'
import { corpus, missingAudio } from './corpus'

const all = corpus()

describe('코퍼스', () => {
  test('면접 트랙이 3단계 목표 20장을 넘긴다', () => {
    const interview = all.filter((s) => s.track === 'interview')

    expect(interview.length).toBeGreaterThanOrEqual(20)
  })

  test('모든 문장에 번들된 기준 음원이 붙어 있다', () => {
    expect(missingAudio(all)).toEqual([])
  })

  test('id 가 겹치지 않는다 — 겹치면 복습 기록이 서로를 덮는다', () => {
    const ids = all.map((s) => s.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  test('영어 문장이 겹치지 않는다 — 같은 음원을 두 장이 나눠 쓰면 헷갈린다', () => {
    const sentences = all.map((s) => s.en)

    expect(new Set(sentences).size).toBe(sentences.length)
  })

  test('문장마다 출처가 적혀 있다 — 사실이 바뀌면 추적해서 고친다', () => {
    expect(all.every((s) => s.source.length > 0)).toBe(true)
  })

  test('입으로 말할 수 있는 길이다 (영어 22단어 이하)', () => {
    const tooLong = all.filter((s) => s.en.split(/\s+/).length > 22).map((s) => s.en)

    expect(tooLong).toEqual([])
  })

  test('못 들었을 때 표현이 들어 있다 — 실전에서 가장 쓸모 있다', () => {
    const recovery = all.filter((s) => s.group === '못 들었을 때')

    expect(recovery.length).toBeGreaterThanOrEqual(15)
  })

  test('번들 문장은 전부 코퍼스 소유다 (custom 아님)', () => {
    expect(all.every((s) => s.custom === false)).toBe(true)
  })
})
