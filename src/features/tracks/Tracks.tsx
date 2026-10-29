// 묶음. 트랙 안의 묶음별 진도를 보고, **묶음 하나만 골라 연습**할 수 있다.
// 면접 전날에는 '못 들었을 때' 만 돌리고 싶을 수 있다. 그게 이 화면의 이유다.
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../store/app'
import { useToday } from '../../hooks/useToday'
import { TRACKS, TRACK_LABELS } from '../../domain/types'
import type { Sentence } from '../../domain/types'
import { groupRows } from './groupRows'
import './tracks.css'

export function Tracks() {
  const navigate = useNavigate()
  const ready = useApp((s) => s.ready)
  const entities = useApp((s) => s.entities)
  const today = useToday()

  if (!ready) return <p className="trk__wait">읽는 중이에요…</p>

  const practice = (sentences: readonly Sentence[]) => {
    useApp.getState().startSessionOf(sentences.map((row) => row.id))
    navigate('/session')
  }

  const byTrack = TRACKS.map((track) => ({
    track,
    sentences: Object.values(entities.sentences).filter((row) => row.track === track),
  })).filter((row) => row.sentences.length > 0)

  return (
    <main className="trk has-dock">
      <h1 className="trk__head">묶음</h1>
      <p className="trk__lead">묶음 하나만 골라 연습할 수도 있어요. 면접 직전에는 '못 들었을 때' 만 돌려 보세요.</p>

      {byTrack.map(({ track, sentences }) => (
        <section key={track} aria-labelledby={`track-${track}`}>
          <h2 id={`track-${track}`} className="trk__title">
            {TRACK_LABELS[track]}
            <span className="trk__total tnum">{sentences.length}장</span>
          </h2>
          <ul className="trk__groups">
            {groupRows(sentences, entities.reviews, today).map((row) => (
              <li key={row.group}>
                <button
                  type="button"
                  className="trk__group"
                  onClick={() => practice(sentences.filter((each) => each.group === row.group))}
                >
                  <span className="trk__name">{row.group}</span>
                  <span className="trk__meter" aria-hidden>
                    <span className="trk__fill" style={{ width: `${Math.round((row.solid / row.total) * 100)}%` }} />
                  </span>
                  <span className="trk__count tnum">
                    {row.solid} / {row.total}
                    {row.due > 0 ? <em className="trk__due"> · {row.due} 대기</em> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
