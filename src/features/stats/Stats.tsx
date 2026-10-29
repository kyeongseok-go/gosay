// 기록. 숫자를 늘어놓는 화면이 아니라 **무엇이 약점인지** 보는 화면이다.
import { useApp } from '../../store/app'
import { useToday } from '../../hooks/useToday'
import { addDays, shortKorean, streakOf } from '../../domain/date'
import type { Sentence } from '../../domain/types'
import './stats.css'

/** 막대로 보여 줄 지난 날 수. 2주면 흐름이 보이고 폰 한 화면에 들어간다. */
const WINDOW_DAYS = 14
/** 약점 목록에 올릴 문장 수 */
const WEAK_LIMIT = 8

/** 약점 한 줄: 막힌 횟수와 그 문장 */
interface WeakRow {
  stuckCount: number
  sentence: Sentence
}

export function Stats() {
  const ready = useApp((s) => s.ready)
  const entities = useApp((s) => s.entities)
  const today = useToday()

  if (!ready) return <p className="stats__wait">읽는 중이에요…</p>

  const days = Array.from({ length: WINDOW_DAYS }, (_, back) => {
    const date = addDays(today, -(WINDOW_DAYS - 1 - back))
    return { date, spoken: entities.days[date]?.spoken ?? 0 }
  })
  const peak = Math.max(1, ...days.map((row) => row.spoken))
  const total = Object.values(entities.days).reduce((sum, row) => sum + row.spoken, 0)
  const streak = streakOf(
    Object.values(entities.days)
      .filter((row) => row.spoken > 0)
      .map((row) => row.date),
    today,
  )

  const stuckReviews = Object.values(entities.reviews)
    .filter((row) => row.stuckCount > 0)
    .sort((a, b) => b.stuckCount - a.stuckCount || (a.reviewedAt ?? '').localeCompare(b.reviewedAt ?? ''))
  const weak: WeakRow[] = stuckReviews
    .slice(0, WEAK_LIMIT)
    .map((review) => ({ stuckCount: review.stuckCount, sentence: entities.sentences[review.sentenceId] }))
    .filter((row): row is WeakRow => row.sentence !== undefined)

  return (
    <main className="stats has-dock">
      <h1 className="stats__head">기록</h1>

      <dl className="facts">
        <div className="facts__cell">
          <dt>누적 말한 문장</dt>
          <dd className="tnum">{total}</dd>
        </div>
        <div className="facts__cell">
          <dt>연속</dt>
          <dd className="tnum">{streak}일</dd>
        </div>
        <div className="facts__cell">
          <dt>막힌 적 있는 문장</dt>
          <dd className="tnum">{stuckReviews.length}</dd>
        </div>
      </dl>

      <section aria-labelledby="chart-title">
        <h2 id="chart-title" className="stats__title">
          최근 2주
        </h2>
        <ol className="chart">
          {days.map((row) => (
            <li key={row.date} className="chart__col">
              <span
                className={`chart__bar${row.spoken > 0 ? ' chart__bar--on' : ''}`}
                style={{ height: `${Math.round((row.spoken / peak) * 100)}%` }}
              />
              <span className="sr-only">
                {shortKorean(row.date)} {row.spoken}문장
              </span>
            </li>
          ))}
        </ol>
        <p className="chart__axis">
          <span>{shortKorean(days[0].date)}</span>
          <span>오늘</span>
        </p>
      </section>

      <section aria-labelledby="weak-title">
        <h2 id="weak-title" className="stats__title">
          막힌 문장
        </h2>
        {weak.length === 0 ? (
          <p className="stats__empty">아직 막힌 문장이 없어요. 몇 번 더 돌려 보면 여기가 채워져요.</p>
        ) : (
          <ul className="weak">
            {weak.map(({ stuckCount, sentence }) => (
              <li key={sentence.id} className="weak__row">
                <div className="weak__text">
                  <p className="weak__ko">{sentence.ko}</p>
                  <p className="weak__en" lang="en">
                    {sentence.en}
                  </p>
                </div>
                <span className="weak__count tnum" title="막힌 횟수">
                  {stuckCount}번
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
