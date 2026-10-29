// 카드 한 장의 4박자. **이 화면이 앱의 전부다.**
//
//   1 듣기        기준 음원을 듣는다
//   2 겹쳐 말하기  음원을 틀고 동시에 따라 말한다 (섀도잉)
//   3 가린 채 말하기 영어를 감추고 한국어만 보고 입으로 낸다. 이때 녹음한다  ← 존재 이유
//   4 대조와 채점  내 녹음 ↔ 기준 음원을 번갈아 듣고 스스로 3단계로 채점한다
//
// 화면 규칙: 글자가 크고, 버튼은 엄지가 닿는 아래쪽에, 한 번에 하나만 두드러진다.
// 정보 밀도를 올리지 않는다 — 지하철에서 한 손으로 쓴다.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mic, Pause, Play, Square } from 'lucide-react'
import { usePlayer } from '../../hooks/usePlayer'
import { useToday } from '../../hooks/useToday'
import { useRecorder } from '../../hooks/useRecorder'
import { saveRecording } from '../../db/persist'
import { db, useApp } from '../../store/app'
import { sessionSummary } from '../../store/store'
import { shortKorean } from '../../domain/date'
import { currentSentenceId, isFinished } from '../../domain/session'
import { BEAT_LABELS, BEATS, GRADE_LABELS } from '../../domain/types'
import type { Grade, Sentence, Session } from '../../domain/types'
import { audioUrl } from './audioUrl'
import './session.css'

const GRADES: readonly Grade[] = ['stuck', 'shaky', 'fluent']
/** 채점 버튼에 붙는 한 줄 설명. 고를 때 망설이지 않게 한다. */
const GRADE_HINTS: Readonly<Record<Grade, string>> = {
  stuck: '입이 안 떨어졌다',
  shaky: '나왔지만 더듬었다',
  fluent: '생각 없이 나왔다',
}

export function SessionScreen() {
  const navigate = useNavigate()
  const session = useApp((s) => Object.values(s.entities.sessions).find((row) => row.finishedAt === null))
  const sentences = useApp((s) => s.entities.sentences)
  const ready = useApp((s) => s.ready)

  if (!ready) return <p className="stage__wait">읽는 중이에요…</p>
  if (!session || isFinished(session)) return <Done />

  const id = currentSentenceId(session)
  const sentence = id === null ? undefined : sentences[id]
  if (!sentence) return <Done />

  return (
    <Card
      // 카드가 바뀌면 재생·녹음 상태를 전부 새로 시작한다. 이전 카드의 녹음이 남으면 안 된다.
      key={`${session.id}:${session.index}`}
      session={session}
      sentence={sentence}
      onEnd={() => {
        useApp.getState().endSession()
        navigate('/')
      }}
    />
  )
}

interface CardProps {
  session: Session
  sentence: Sentence
  onEnd: () => void
}

function Card({ session, sentence, onEnd }: CardProps) {
  const speed = useApp((s) => s.settings.speed)
  const player = usePlayer()
  const recorder = useRecorder()
  const [revealed, setRevealed] = useState(false)
  const saved = useRef(false)

  const beat = session.beat
  const at = BEATS.indexOf(beat)
  const total = session.sentenceIds.length

  // 녹음이 끝나면 저장한다. 실패해도 이 카드의 대조는 메모리의 주소로 그대로 된다.
  useEffect(() => {
    if (!recorder.blob || !recorder.mime || saved.current) return
    saved.current = true
    void saveRecording(db, {
      id: `${sentence.id}:${Date.now()}`,
      sentenceId: sentence.id,
      blob: recorder.blob,
      mime: recorder.mime,
      createdAt: Date.now(),
    }).catch(() => {
      // 저장 용량이 꽉 찼거나 사생활 보호 창. 연습을 막을 이유는 아니다.
    })
  }, [recorder.blob, recorder.mime, sentence.id])

  const playReference = () => {
    player.stop()
    if (sentence.audio) player.play(audioUrl(sentence.audio), '기준', speed)
    else player.speak(sentence.en, '기준', speed)
  }

  const grade = (chosen: Grade) => {
    player.stop()
    recorder.stop()
    useApp.getState().grade(chosen)
  }

  const step = () => {
    player.stop()
    useApp.getState().nextBeat()
  }

  return (
    <section className="stage" aria-labelledby="beat-title">
      <header className="stage__top">
        <ol className="beatbar" aria-label={`박자 ${at + 1} / 4`}>
          {BEATS.map((each, index) => (
            <li
              key={each}
              className={`beatbar__seg${index <= at ? ' beatbar__seg--on' : ''}`}
              aria-current={index === at ? 'step' : undefined}
            >
              <span className="sr-only">{BEAT_LABELS[each]}</span>
            </li>
          ))}
        </ol>
        <p className="stage__count tnum">
          {session.index + 1} / {total}
        </p>
        <button type="button" className="stage__end" onClick={onEnd}>
          접기
        </button>
      </header>

      <h1 id="beat-title" className="stage__beat">
        {BEAT_LABELS[beat]}
      </h1>

      <div className="stage__body">
        <p className="stage__ko">{sentence.ko}</p>

        {beat === 'produce' && !revealed ? (
          <button type="button" className="stage__peek" onClick={() => setRevealed(true)}>
            도저히 안 나오면 열기
          </button>
        ) : (
          <p className="stage__en" lang="en">
            {sentence.en}
          </p>
        )}

        {beat === 'compare' && sentence.note ? <p className="stage__note">{sentence.note}</p> : null}
      </div>

      <div className="stage__hint">
        {hintFor(beat, recorder.phase)}
        {/* 직접 넣은 문장은 기준 음원이 없다. 소리가 다르게 들리는 이유를 말해 둔다. */}
        {sentence.audio === null ? <span className="stage__tts"> 이 문장은 브라우저 음성으로 읽어요.</span> : null}
      </div>

      <footer className="stage__foot">
        {beat === 'listen' || beat === 'shadow' ? (
          <>
            <button type="button" className="btn btn--round" onClick={playReference}>
              {player.playing ? <Pause aria-hidden /> : <Play aria-hidden />}
              <span className="sr-only">기준 음원 재생</span>
            </button>
            <SpeedPick />
            <button type="button" className="btn btn--wide" onClick={step}>
              {beat === 'listen' ? '들었다, 다음' : '따라 말했다, 다음'}
            </button>
          </>
        ) : null}

        {beat === 'produce' ? (
          <>
            {recorder.phase === 'recording' ? (
              <button type="button" className="btn btn--round btn--rec" onClick={recorder.stop}>
                <Square aria-hidden />
                <span className="sr-only">녹음 멈추기</span>
              </button>
            ) : (
              <button type="button" className="btn btn--round" onClick={() => void recorder.start()}>
                <Mic aria-hidden />
                <span className="sr-only">녹음 시작</span>
              </button>
            )}
            <button type="button" className="btn btn--wide" onClick={step}>
              말했다, 들어 보기
            </button>
          </>
        ) : null}

        {beat === 'compare' ? (
          <>
            <div className="ab">
              <button
                type="button"
                className={`btn btn--ab${player.playing === '기준' ? ' btn--on' : ''}`}
                onClick={playReference}
              >
                기준 음원
              </button>
              <button
                type="button"
                className={`btn btn--ab${player.playing === '내 녹음' ? ' btn--on' : ''}`}
                disabled={recorder.url === null}
                onClick={() => recorder.url && player.play(recorder.url, '내 녹음')}
              >
                내 녹음
              </button>
            </div>
            <ul className="grades">
              {GRADES.map((each) => (
                <li key={each}>
                  <button type="button" className={`btn btn--grade btn--${each}`} onClick={() => grade(each)}>
                    <span className="btn__label">{GRADE_LABELS[each]}</span>
                    <span className="btn__hint">{GRADE_HINTS[each]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </footer>
    </section>
  )
}

/** 박자마다 무엇을 해야 하는지 한 줄. 처음 쓰는 사람도 설명 없이 된다. */
function hintFor(beat: Session['beat'], phase: ReturnType<typeof useRecorder>['phase']): string {
  if (beat === 'listen') return '소리만 듣습니다. 아직 따라 하지 않습니다.'
  if (beat === 'shadow') return '음원을 틀고 같은 속도로 겹쳐 말합니다.'
  if (beat === 'produce') {
    if (phase === 'recording') return '지금 녹음 중입니다. 한국어만 보고 영어로 말하세요.'
    if (phase === 'denied') return '마이크를 쓸 수 없어요. 녹음 없이 소리 내어 말하고 넘어가세요.'
    if (phase === 'unsupported') return '이 브라우저는 녹음을 지원하지 않아요. 소리 내어 말하고 넘어가세요.'
    return '영어를 보지 말고 한국어만 보고 말하세요.'
  }
  return '두 소리를 번갈아 듣고, 막혔는지 아닌지만 고릅니다.'
}

function SpeedPick() {
  const speed = useApp((s) => s.settings.speed)
  return (
    <div className="speed" role="group" aria-label="재생 속도">
      {[0.75, 1].map((rate) => (
        <button
          key={rate}
          type="button"
          className={`speed__pick${speed === rate ? ' speed__pick--on' : ''}`}
          aria-pressed={speed === rate}
          onClick={() => useApp.getState().updateSettings({ speed: rate })}
        >
          {rate}×
        </button>
      ))}
    </div>
  )
}

/**
 * 세션 끝 요약. 방금 무엇을 했고 **무엇이 막혔는지**를 보여 준다.
 * 막힌 문장을 다시 보여 주는 것이 이 화면의 이유다 — 그게 다음에 볼 것이다.
 */
function Done() {
  const today = useToday()
  const sentences = useApp((s) => s.entities.sentences)
  const reviews = useApp((s) => s.entities.reviews)
  const session = useApp((s) =>
    Object.values(s.entities.sessions)
      .filter((row) => row.date === today && row.finishedAt !== null)
      .sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? ''))
      .at(-1),
  )

  const summary = session ? sessionSummary(session, sentences) : null
  const nextDue = session
    ? [...new Set(session.sentenceIds)]
        .map((id) => reviews[id]?.due)
        .filter((due): due is string => due !== undefined && due > today)
        .sort()[0]
    : undefined

  return (
    <section className="stage stage--done">
      <h1 className="stage__beat">
        {summary && summary.spoken > 0 ? `${summary.spoken}문장을 입으로 냈어요` : '오늘 몫을 끝냈어요'}
      </h1>

      {summary && summary.stuck.length > 0 ? (
        <div className="recap">
          <h2 className="recap__title">막힌 문장 {summary.stuck.length}개 — 다음에 먼저 나와요</h2>
          <ul className="recap__list">
            {summary.stuck.map((row) => (
              <li key={row.id} className="recap__row">
                <p className="recap__ko">{row.ko}</p>
                <p className="recap__en" lang="en">
                  {row.en}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="stage__hint">
          {summary && summary.spoken > 0 ? '막힌 문장이 없었어요.' : '입으로 낸 문장은 기록에 쌓였어요.'}
        </p>
      )}

      {nextDue ? <p className="recap__next">다음 복습 예정: {shortKorean(nextDue)}</p> : null}

      <Link className="btn btn--wide" to="/">
        오늘로 돌아가기
      </Link>
    </section>
  )
}
