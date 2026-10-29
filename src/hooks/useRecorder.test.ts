import { describe, expect, test } from 'vitest'
import { CANDIDATE_MIMES, pickMime } from './useRecorder'

describe('pickMime', () => {
  test('데스크톱 크롬처럼 webm 이 되면 opus 를 고른다', () => {
    const chosen = pickMime((mime) => mime.startsWith('audio/webm'))

    expect(chosen).toBe('audio/webm;codecs=opus')
  })

  test('iOS 처럼 webm 이 없으면 audio/mp4 로 떨어진다 — 이 앱의 가장 중요한 실기기 제약이다', () => {
    const chosen = pickMime((mime) => mime === 'audio/mp4' || mime === 'audio/aac')

    expect(chosen).toBe('audio/mp4')
  })

  test('아무것도 안 되면 null 이다 — 녹음만 숨기고 연습은 계속한다', () => {
    expect(pickMime(() => false)).toBeNull()
  })

  test('후보는 좋은 것부터 나열돼 있다', () => {
    expect(CANDIDATE_MIMES[0]).toContain('opus')
    expect(CANDIDATE_MIMES).toContain('audio/mp4')
  })
})
