// 샘플 데이터. **이게 없으면 스크린샷 검증이 불가능하다** — 빈 화면만 찍힌다.
// 개발 서버와 E2E 에서 `window.__gosay.seedDemo(...)` 로 부른다. 프로덕션 번들에는 들어가지 않는다.
import { db, useApp } from '../store/app'
import { addDays, dayKeyOf } from '../domain/date'
import { nextReview, startingReview } from '../domain/review'
import type { DayLog, Grade, Review } from '../domain/types'

export interface SeedOptions {
  /** 복습이 밀린 문장 수 */
  due?: number
  /** 기록을 남길 지난 날 수(연속일이 그만큼 보인다) */
  days?: number
  /** 세션을 시작만 해 둘까(첫 박자) */
  startSession?: boolean
  /** 세션을 중간까지 진행한 상태로 둘까(3박자) */
  midSession?: boolean
}

/**
 * 오늘 기준으로 "며칠 써 온 사람" 의 상태를 만든다.
 * 복습 예정·연속일·막힌 문장이 모두 0 이면 어떤 화면도 제대로 안 보인다.
 */
export async function seedDemo(options: SeedOptions = {}): Promise<void> {
  const { due = 5, days = 4, startSession = false, midSession = false } = options
  const store = useApp.getState()
  await store.load()

  const today = dayKeyOf(Date.now())
  const ids = Object.values(store.entities.sentences)
    .filter((row) => row.track === 'work')
    .map((row) => row.id)

  const reviews: Review[] = []
  const grades: Grade[] = ['fluent', 'shaky', 'stuck']
  ids.slice(0, due).forEach((id, index) => {
    const first = nextReview(startingReview(id, addDays(today, -7)), grades[index % 3], addDays(today, -7))
    // 복습일을 오늘 이전으로 당겨 "기다리는 문장" 으로 만든다.
    reviews.push({ ...first, due: addDays(today, -(index % 3)) })
  })

  const log: DayLog[] = Array.from({ length: days }, (_, back) => ({
    date: addDays(today, -(back + 1)),
    spoken: 6 + (back % 3),
    stuck: back % 2,
  }))

  store.commit({ puts: { reviews, days: log }, deletes: {} })
  await store.settled()

  if (startSession || midSession) {
    store.startSession()
    if (midSession) {
      store.nextBeat()
      store.nextBeat()
    }
    await store.settled()
  }
}

/** 화면을 비운 상태로 되돌린다. 빈 화면 스크린샷을 찍을 때 쓴다. */
export async function clearDemo(): Promise<void> {
  await db.reviews.clear()
  await db.sessions.clear()
  await db.days.clear()
  await useApp.getState().load()
  window.location.reload()
}
