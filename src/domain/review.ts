// 간격 반복. SM-2 를 세 단계 채점에 맞춰 줄인 것이다. 전부 순수 함수고 오늘을 인자로 받는다.
//
// 보통의 간격 반복과 다른 점: 정답 판정이 없다. 사람이 "막혔다 / 더듬었다 / 바로 나왔다" 중
// 하나를 고르고, 그 값만으로 일정이 움직인다. 막혔는지 아닌지는 본인이 가장 정확하게 안다.
import { addDays, isOnOrBefore } from './date'
import type { DayKey } from './date'
import type { Grade, Review } from './types'

/** 쉬움 계수의 바닥. 이 밑으로 내려가면 같은 문장이 영원히 돌아온다. */
export const EASE_FLOOR = 1.3
/** 쉬움 계수의 천장. 넘기면 한 번 잘 나온 문장이 너무 멀리 밀린다. */
export const EASE_CEILING = 2.8
/** 간격 상한(일). 면접 준비에 반년 뒤 일정은 뜻이 없다. */
export const MAX_INTERVAL = 60

const EASE_START = 2
const EASE_UP = 0.1
const EASE_DOWN_SHAKY = 0.15
const EASE_DOWN_STUCK = 0.3
/** 처음 만난 문장을 바로 말했을 때의 첫 간격(일) */
const FIRST_FLUENT_INTERVAL = 2

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 소수점 둘째 자리까지. 0.1 을 더하다 생기는 부동소수 꼬리를 자른다. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 아직 한 번도 연습하지 않은 문장의 복습 상태. 오늘이 곧 복습일이다. */
export function startingReview(sentenceId: string, today: DayKey): Review {
  return {
    sentenceId,
    due: today,
    interval: 0,
    ease: EASE_START,
    streak: 0,
    lastGrade: null,
    stuckCount: 0,
    reviewedAt: null,
  }
}

/** 오늘 연습할 문장인가. 복습 기록이 없으면 처음 보는 문장이라 대상이다. */
export function dueOn(review: Review | undefined, today: DayKey): boolean {
  if (!review) return true
  return isOnOrBefore(review.due, today)
}

/** 채점 하나로 다음 간격을 계산한다. 원본은 건드리지 않고 새 행을 돌려준다. */
export function nextReview(prev: Review, grade: Grade, today: DayKey): Review {
  const base = { ...prev, lastGrade: grade, reviewedAt: today }

  if (grade === 'stuck') {
    // 간격을 초기화하고 오늘 안에 다시 내보낸다. 막힌 문장을 다음 날로 넘기면 막힌 채로 남는다.
    return {
      ...base,
      interval: 0,
      due: today,
      ease: round2(clamp(prev.ease - EASE_DOWN_STUCK, EASE_FLOOR, EASE_CEILING)),
      streak: 0,
      stuckCount: prev.stuckCount + 1,
    }
  }

  if (grade === 'shaky') {
    // 간격은 그대로 두고 ease 만 깎는다. 더듬은 문장을 더 멀리 밀면 다음에도 더듬는다.
    const interval = Math.max(1, prev.interval)
    return {
      ...base,
      interval,
      due: addDays(today, interval),
      ease: round2(clamp(prev.ease - EASE_DOWN_SHAKY, EASE_FLOOR, EASE_CEILING)),
      streak: 0,
    }
  }

  const ease = round2(clamp(prev.ease + EASE_UP, EASE_FLOOR, EASE_CEILING))
  const grown = prev.interval === 0 ? FIRST_FLUENT_INTERVAL : Math.round(prev.interval * prev.ease)
  const interval = Math.min(MAX_INTERVAL, grown)
  return {
    ...base,
    interval,
    due: addDays(today, interval),
    ease,
    streak: prev.streak + 1,
  }
}
