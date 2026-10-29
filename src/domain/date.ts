// 날짜 헬퍼. **어느 함수도 Date.now() 를 부르지 않는다.** 오늘·지금은 늘 인자로 받는다.
// 그래서 테스트에서 시간을 가짜로 만들 필요가 없고, 월말·윤년·연말 경계를 직접 넣어 볼 수 있다.

/** 'YYYY-MM-DD' 한 날짜. 지역 시간대 기준이다(사람이 보는 '오늘'과 같아야 한다). */
export type DayKey = string

const MS_PER_DAY = 86_400_000

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 타임스탬프를 그 지역의 'YYYY-MM-DD' 로 만든다. */
export function dayKeyOf(timestamp: number): DayKey {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' 를 그 날 0시의 타임스탬프로. 잘못된 모양이면 던진다. */
export function timestampOf(day: DayKey): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) throw new Error(`날짜 모양이 아니에요: ${day}`)
  const [, year, month, date] = match
  return new Date(Number(year), Number(month) - 1, Number(date)).getTime()
}

/** 날짜를 일 단위로 옮긴다. 월말·연말·윤년은 Date 가 알아서 넘긴다. */
export function addDays(day: DayKey, days: number): DayKey {
  return dayKeyOf(timestampOf(day) + days * MS_PER_DAY)
}

/** a 에서 b 까지 며칠인가. b 가 더 이르면 음수다. */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((timestampOf(b) - timestampOf(a)) / MS_PER_DAY)
}

/** 'YYYY-MM-DD' 둘을 비교한다. 문자열 비교로 충분한 모양이다. */
export function isOnOrBefore(day: DayKey, limit: DayKey): boolean {
  return day <= limit
}

/**
 * 오늘까지 이어진 연속일. 날짜 목록은 순서가 없어도 된다.
 * 어제까지만 했으면 아직 끊기지 않은 것으로 본다(오늘 하루가 다 가기 전이니까).
 */
export function streakOf(days: readonly DayKey[], today: DayKey): number {
  const done = new Set(days)
  const start = done.has(today) ? today : addDays(today, -1)
  if (!done.has(start)) return 0
  let count = 0
  let cursor = start
  while (done.has(cursor)) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

/** 'M월 D일' — 화면에 쓰는 짧은 한국어 표기 */
export function shortKorean(day: DayKey): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return day
  return `${Number(match[1])}월 ${Number(match[2])}일`
}
