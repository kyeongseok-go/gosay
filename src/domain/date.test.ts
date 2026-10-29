import { describe, expect, test } from 'vitest'
import { addDays, dayKeyOf, daysBetween, isOnOrBefore, shortKorean, streakOf, timestampOf } from './date'

describe('dayKeyOf / timestampOf', () => {
  test('지역 시간 자정을 왕복해도 같은 날이다', () => {
    const day = '2024-02-29'

    expect(dayKeyOf(timestampOf(day))).toBe(day)
  })

  test('한 자리 월·일을 0 으로 채운다', () => {
    expect(dayKeyOf(new Date(2026, 0, 5).getTime())).toBe('2026-01-05')
  })

  test('날짜 모양이 아니면 던진다 — 저장된 값이 깨졌을 때 조용히 틀리지 않게', () => {
    expect(() => timestampOf('2026/10/29')).toThrow()
    expect(() => timestampOf('')).toThrow()
  })
})

describe('addDays', () => {
  test('월말을 넘는다', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })

  test('연말을 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  test('윤년 2월을 지난다', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  test('뒤로도 간다', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('daysBetween', () => {
  test('앞뒤 차이를 일 단위로 센다', () => {
    expect(daysBetween('2026-10-29', '2026-11-05')).toBe(7)
    expect(daysBetween('2026-11-05', '2026-10-29')).toBe(-7)
    expect(daysBetween('2026-10-29', '2026-10-29')).toBe(0)
  })

  test('서머타임이 있는 지역에서도 날 수가 어긋나지 않는다', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })
})

describe('isOnOrBefore', () => {
  test('같은 날도 포함한다', () => {
    expect(isOnOrBefore('2026-10-29', '2026-10-29')).toBe(true)
    expect(isOnOrBefore('2026-10-28', '2026-10-29')).toBe(true)
    expect(isOnOrBefore('2026-10-30', '2026-10-29')).toBe(false)
  })
})

describe('streakOf', () => {
  test('오늘부터 거꾸로 이어진 날을 센다', () => {
    const days = ['2026-10-29', '2026-10-28', '2026-10-27']

    expect(streakOf(days, '2026-10-29')).toBe(3)
  })

  test('어제까지만 했으면 아직 끊긴 것이 아니다 — 오늘이 다 가지 않았다', () => {
    expect(streakOf(['2026-10-28', '2026-10-27'], '2026-10-29')).toBe(2)
  })

  test('그제까지만 했으면 끊겼다', () => {
    expect(streakOf(['2026-10-27'], '2026-10-29')).toBe(0)
  })

  test('기록이 없으면 0 이다', () => {
    expect(streakOf([], '2026-10-29')).toBe(0)
  })

  test('중간이 비면 거기서 끊는다', () => {
    const days = ['2026-10-29', '2026-10-28', '2026-10-26']

    expect(streakOf(days, '2026-10-29')).toBe(2)
  })

  test('순서가 섞여 있어도 같다', () => {
    const days = ['2026-10-27', '2026-10-29', '2026-10-28']

    expect(streakOf(days, '2026-10-29')).toBe(3)
  })
})

describe('shortKorean', () => {
  test('앞의 0 을 떼고 읽는다', () => {
    expect(shortKorean('2026-01-05')).toBe('1월 5일')
  })

  test('모양이 아니면 그대로 돌려준다', () => {
    expect(shortKorean('언젠가')).toBe('언젠가')
  })
})
