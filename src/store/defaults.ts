import { TRACKS } from '../domain/types'
import type { Settings, Track } from '../domain/types'

/**
 * 하루 분량. 10분 세션에 카드 8장이 들어간다 — 한 장이 4박자라 실제로 32번 누른다.
 * 더 늘리면 지하철에서 못 끝내고, 못 끝내면 다음 날 안 열게 된다.
 */
export const DEFAULT_DAILY_COUNT = 8
/** 밀린 복습 상한. 3일 비워도 한 세션이 터지지 않게 한다. */
export const DEFAULT_CATCH_UP_CAP = 12

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    dailyCount: DEFAULT_DAILY_COUNT,
    speed: 1,
    theme: 'auto',
    catchUpCap: DEFAULT_CATCH_UP_CAP,
    tracks: ['work', 'term', 'fix', 'small'],
  }
}

/** 저장된 설정에 새로 생긴 필드를 기본값으로 채운다. 예전 버전에서 저장된 행도 그대로 쓴다. */
export function mergeSettings(stored: Partial<Settings> | null | undefined): Settings {
  const base = defaultSettings()
  if (!stored) return base
  // 없어진 트랙 이름이 저장돼 있을 수 있다(면접 트랙을 걷어냈다). 모르는 이름은 버린다.
  const known = (stored.tracks ?? []).filter((track): track is Track => TRACKS.includes(track))
  return {
    ...base,
    ...stored,
    id: 'settings',
    // 트랙이 비면 세션이 늘 0장이 된다. 빈 배열로 저장된 설정을 그대로 믿지 않는다.
    tracks: known.length ? known : base.tracks,
  }
}
