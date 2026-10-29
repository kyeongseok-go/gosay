// 오늘. **첫 화면에서 한 번 눌러 바로 시작된다.** 그 외에는 숫자 몇 개만 둔다.
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/app'
import { useToday } from '../../hooks/useToday'
import { streakOf } from '../../domain/date'
import { dueOn } from '../../domain/review'
import { currentSentenceId, isFinished } from '../../domain/session'
import { TRACK_LABELS } from '../../domain/types'
import './today.css'

export function Today() {
  const navigate = useNavigate()
  const ready = useApp((s) => s.ready)
  const entities = useApp((s) => s.entities)
  const settings = useApp((s) => s.settings)
  const today = useToday()

  if (!ready) return <p className="today__wait">읽는 중이에요…</p>

  const open = Object.values(entities.sessions).find((row) => row.finishedAt === null)
  const resuming = open !== undefined && !isFinished(open)

  const allowed = new Set(settings.tracks)
  const pool = Object.values(entities.sentences).filter((s) => allowed.has(s.track))
  const waiting = pool.filter((s) => dueOn(entities.reviews[s.id], today)).length
  const planned = Math.min(waiting, settings.dailyCount)

  const days = Object.values(entities.days)
    .filter((row) => row.spoken > 0)
    .map((row) => row.date)
  const streak = streakOf(days, today)
  const spokenToday = entities.days[today]?.spoken ?? 0

  const start = () => {
    useApp.getState().startSession()
    navigate('/session')
  }

  return (
    <main className="today">
      <header className="today__head">
        <p className="today__mark">gosay</p>
        <h1 className="today__line">
          아는 문장이 아니라
          <br />
          <em>나오는 문장</em>으로.
        </h1>
      </header>

      <button type="button" className="today__go" onClick={start} disabled={planned === 0 && !resuming}>
        <span className="today__go-label">
          {resuming ? '이어서 하기' : planned === 0 ? '오늘 몫을 끝냈어요' : '오늘 연습 시작'}
        </span>
        <span className="today__go-sub">
          {resuming
            ? `${(open?.index ?? 0) + 1}번째 카드부터`
            : planned === 0
              ? '내일 다시 나와요'
              : `카드 ${planned}장 · 10분`}
        </span>
      </button>

      {resuming && open ? (
        <p className="today__resume">
          중단한 자리를 그대로 두었어요. {nextKo(open, entities.sentences)}
        </p>
      ) : null}

      <dl className="facts">
        <div className="facts__cell">
          <dt>오늘 말한 문장</dt>
          <dd className="tnum">{spokenToday}</dd>
        </div>
        <div className="facts__cell">
          <dt>연속</dt>
          <dd className="tnum">{streak}일</dd>
        </div>
        <div className="facts__cell">
          <dt>기다리는 문장</dt>
          <dd className="tnum">{waiting}</dd>
        </div>
      </dl>

      <p className="today__tracks">
        연습 중: {settings.tracks.map((track) => TRACK_LABELS[track]).join(', ')} · 문장 {pool.length}장
      </p>
    </main>
  )
}

/** 이어서 할 카드의 한국어 앞부분. 어디서 멈췄는지 알아보게 한다. */
function nextKo(
  session: Parameters<typeof currentSentenceId>[0],
  sentences: Record<string, { ko: string }>,
): string {
  const id = currentSentenceId(session)
  const ko = id === null ? null : sentences[id]?.ko
  if (!ko) return ''
  return ko.length > 24 ? `"${ko.slice(0, 24)}…"` : `"${ko}"`
}
