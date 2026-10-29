// 한 세션을 짜고, 박자와 카드를 넘긴다. 전부 순수 함수다 — 오늘·지금·id 를 인자로 받는다.
//
// 세션은 10분이다. 그래서 두 가지만 지킨다:
//   1) 밀린 복습이 100장 몰려도 상한에서 끊는다. 몰리면 사람이 그냥 안 한다.
//   2) 막힌 문장은 다음 날로 넘기지 않고 같은 세션 안에서 한 번 더 내보낸다.
import type { DayKey } from './date'
import { dueOn } from './review'
import { BEATS } from './types'
import type { Grade, Review, Sentence, Session, Track } from './types'

export interface BuildSessionInput {
  id: string
  today: DayKey
  /** ISO 문자열. 바깥에서 만들어 넘긴다. */
  startedAt: string
  sentences: readonly Sentence[]
  reviews: Readonly<Record<string, Review>>
  dailyCount: number
  catchUpCap: number
  tracks: readonly Track[]
}

/** 트랙 우선순위. 면접이 1순위다 — 이 앱을 만든 이유다. */
const TRACK_ORDER: Readonly<Record<Track, number>> = { interview: 0, work: 1, small: 2 }

/**
 * 오늘의 세션을 짠다. 복습 예정을 먼저 담고 남는 자리에 신규를 채운다.
 * 복습 예정 안에서는 더 오래 밀린 것, 그다음 더 많이 막혔던 것이 앞에 온다.
 */
export function buildSession(input: BuildSessionInput): Session {
  const { today, sentences, reviews, dailyCount, catchUpCap, tracks } = input
  const allowed = new Set(tracks)
  const inTracks = sentences.filter((s) => allowed.has(s.track))

  const due = inTracks
    .filter((s) => reviews[s.id] !== undefined && dueOn(reviews[s.id], today))
    .map((s) => ({ sentence: s, review: reviews[s.id] }))
    .sort(
      (a, b) =>
        // 'YYYY-MM-DD' 는 사전순이 곧 날짜순이다. 더 이른(오래 밀린) 복습일이 앞에 온다.
        a.review.due.localeCompare(b.review.due) ||
        b.review.stuckCount - a.review.stuckCount ||
        a.sentence.id.localeCompare(b.sentence.id),
    )
    .slice(0, Math.min(catchUpCap, dailyCount))
    .map(({ sentence }) => sentence.id)

  const fresh = inTracks
    .filter((s) => reviews[s.id] === undefined)
    .sort((a, b) => TRACK_ORDER[a.track] - TRACK_ORDER[b.track])
    .slice(0, Math.max(0, dailyCount - due.length))
    .map((s) => s.id)

  const sentenceIds = [...due, ...fresh]
  return {
    id: input.id,
    date: today,
    sentenceIds,
    index: 0,
    beat: 'listen',
    grades: {},
    startedAt: input.startedAt,
    finishedAt: sentenceIds.length === 0 ? input.startedAt : null,
  }
}

/** 지금 보고 있는 문장. 세션이 끝났으면 없다. */
export function currentSentenceId(session: Session): string | null {
  return session.sentenceIds[session.index] ?? null
}

export function isFinished(session: Session): boolean {
  return session.index >= session.sentenceIds.length
}

/** 한 박자 앞으로. 마지막 박자(대조와 채점)에서는 움직이지 않는다 — 채점이 카드를 넘긴다. */
export function advanceBeat(session: Session): Session {
  const at = BEATS.indexOf(session.beat)
  const next = BEATS[at + 1]
  if (!next) return session
  return { ...session, beat: next }
}

/**
 * 지금 카드를 채점하고 다음 카드로 넘긴다.
 * 막혔으면 그 문장을 세션 끝에 한 번 더 붙인다. **이미 뒤에 있으면 붙이지 않는다** — 끝나지 않는 세션이 된다.
 */
export function submitGrade(session: Session, grade: Grade, now: string): Session {
  const id = currentSentenceId(session)
  if (id === null) return session

  // 한 세션에서 한 문장은 많아도 두 번이다. 이미 다시 넣은 문장을 또 넣으면 세션이 끝나지 않는다.
  const appearances = session.sentenceIds.filter((each) => each === id).length
  const requeue = grade === 'stuck' && appearances === 1
  const sentenceIds = requeue ? [...session.sentenceIds, id] : session.sentenceIds
  const index = session.index + 1

  return {
    ...session,
    sentenceIds,
    grades: { ...session.grades, [id]: grade },
    index,
    beat: 'listen',
    finishedAt: index >= sentenceIds.length ? now : null,
  }
}

/** 이 세션에서 입으로 낸 문장 수 */
export function spokenCount(session: Session): number {
  return Object.keys(session.grades).length
}

/** 이 세션에서 막힌 문장. 세션 끝 요약과 약점 화면이 읽는다. */
export function stuckIds(session: Session): string[] {
  return Object.entries(session.grades)
    .filter(([, grade]) => grade === 'stuck')
    .map(([id]) => id)
}
