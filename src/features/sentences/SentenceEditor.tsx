// 내 문장. 번들 코퍼스에 없는 문장을 직접 넣는다.
//
// 번들 문장은 여기서 고치지 않는다 — 고치면 사실 원장과 어긋난 문장이 조용히 남는다.
// 직접 넣은 문장은 기준 음원이 없으므로 **브라우저 음성으로 읽는다**(그 사실을 화면에 적어 둔다).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, Trash2 } from 'lucide-react'
import { useApp } from '../../store/app'
import { usePlayer } from '../../hooks/usePlayer'
import { TRACKS, TRACK_LABELS } from '../../domain/types'

const EMPTY: Draft = { ko: '', en: '', note: '', track: 'work' }

import { draftToSentence } from './draft'
import type { Draft } from './draft'
import './sentences.css'

export function SentenceEditor() {
  const ready = useApp((s) => s.ready)
  const sentences = useApp((s) => s.entities.sentences)
  const player = usePlayer()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [error, setError] = useState<string | null>(null)

  if (!ready) return <p className="snt__wait">읽는 중이에요…</p>

  const mine = Object.values(sentences)
    .filter((row) => row.custom)
    .sort((a, b) => b.id.localeCompare(a.id))

  const add = () => {
    const sentence = draftToSentence(draft, `own-${Date.now()}`)
    if (!sentence) {
      setError('한국어와 영어를 둘 다 적어 주세요.')
      return
    }
    useApp.getState().commit({ puts: { sentences: [sentence] }, deletes: {} })
    setDraft({ ...EMPTY, track: draft.track })
    setError(null)
  }

  const remove = (id: string) => {
    // 복습 기록도 함께 지운다. 문장이 없는 기록이 남으면 세션이 빈 카드를 만든다.
    useApp.getState().commit({ puts: {}, deletes: { sentences: [id], reviews: [id] } })
  }

  return (
    <main className="snt has-dock">
      <p className="snt__back">
        <Link to="/settings">← 설정</Link>
      </p>
      <h1 className="snt__head">내 문장</h1>
      <p className="snt__lead">
        직접 넣은 문장은 기준 음원이 없어서 브라우저 음성으로 읽어요. 번들 문장만큼 또렷하지 않을 수 있어요.
      </p>

      <section className="snt__form" aria-labelledby="add-title">
        <h2 id="add-title" className="snt__title">
          새 문장
        </h2>

        <label className="field">
          <span className="field__label">한국어</span>
          <textarea
            className="field__input"
            rows={2}
            value={draft.ko}
            placeholder="말하고 싶은 한국어 문장"
            onChange={(event) => setDraft({ ...draft, ko: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">영어</span>
          <textarea
            className="field__input"
            rows={2}
            lang="en"
            value={draft.en}
            placeholder="그 문장의 영어"
            onChange={(event) => setDraft({ ...draft, en: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">메모 (선택)</span>
          <input
            className="field__input"
            value={draft.note}
            placeholder="왜 이 표현인지 짧게"
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          />
        </label>

        <div className="field">
          <span className="field__label">트랙</span>
          <div className="pills" role="group" aria-label="트랙">
            {TRACKS.map((track) => (
              <button
                key={track}
                type="button"
                className={`pills__pick${draft.track === track ? ' pills__pick--on' : ''}`}
                aria-pressed={draft.track === track}
                onClick={() => setDraft({ ...draft, track })}
              >
                {TRACK_LABELS[track]}
              </button>
            ))}
          </div>
        </div>

        {error !== null ? (
          <p className="snt__error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="button" className="btn btn--wide" onClick={add}>
          문장 넣기
        </button>
      </section>

      <section aria-labelledby="mine-title">
        <h2 id="mine-title" className="snt__title">
          넣은 문장 {mine.length}장
        </h2>
        {mine.length === 0 ? (
          <p className="snt__empty">아직 없어요. 면접에서 쓰고 싶은 문장을 떠오를 때 넣어 두세요.</p>
        ) : (
          <ul className="snt__list">
            {mine.map((row) => (
              <li key={row.id} className="snt__row">
                <div className="snt__text">
                  <p className="snt__ko">{row.ko}</p>
                  <p className="snt__en" lang="en">
                    {row.en}
                  </p>
                  {row.note ? <p className="snt__note">{row.note}</p> : null}
                </div>
                <div className="snt__acts">
                  <button
                    type="button"
                    className="snt__icon"
                    onClick={() => player.speak(row.en, row.id)}
                    aria-label={`${row.ko} 읽어 주기`}
                  >
                    <Play aria-hidden size={18} />
                  </button>
                  <button
                    type="button"
                    className="snt__icon snt__icon--danger"
                    onClick={() => remove(row.id)}
                    aria-label={`${row.ko} 지우기`}
                  >
                    <Trash2 aria-hidden size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
