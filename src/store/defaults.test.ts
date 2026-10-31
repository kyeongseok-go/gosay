import { describe, expect, test } from 'vitest'
import { DEFAULT_CATCH_UP_CAP, DEFAULT_DAILY_COUNT, defaultSettings, mergeSettings } from './defaults'

describe('mergeSettings', () => {
  test('저장된 것이 없으면 기본값이다', () => {
    expect(mergeSettings(null)).toEqual(defaultSettings())
  })

  test('저장된 값은 그대로 두고 빠진 필드만 채운다', () => {
    const merged = mergeSettings({ dailyCount: 12, tracks: ['term'] })

    expect(merged.dailyCount).toBe(12)
    expect(merged.tracks).toEqual(['term'])
    expect(merged.catchUpCap).toBe(DEFAULT_CATCH_UP_CAP)
  })

  test('트랙이 비면 기본값으로 돌린다 — 비면 세션이 늘 0장이 된다', () => {
    expect(mergeSettings({ tracks: [] }).tracks).toEqual(defaultSettings().tracks)
  })

  test('없어진 트랙 이름은 버린다 — 면접 트랙을 걷어낸 뒤에도 옛 설치본이 열린다', () => {
    const merged = mergeSettings({ tracks: ['interview', 'work'] as never })

    expect(merged.tracks).toEqual(['work'])
  })

  test('모르는 이름만 저장돼 있으면 기본값으로 돌린다', () => {
    const merged = mergeSettings({ tracks: ['interview'] as never })

    expect(merged.tracks).toEqual(defaultSettings().tracks)
    expect(merged.dailyCount).toBe(DEFAULT_DAILY_COUNT)
  })
})
