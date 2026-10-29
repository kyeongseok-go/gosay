// 설정. 자주 바꾸는 것(하루 분량·트랙)이 위, 되돌릴 수 없는 것(전체 삭제)이 맨 아래다.
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { db, useApp } from '../../store/app'
import { clearProgress } from '../../db/persist'
import { TRACKS, TRACK_LABELS } from '../../domain/types'
import type { ThemeChoice, Track } from '../../domain/types'
import { backupFileName, buildBackup, parseBackup } from './backup'
import './settings.css'

const DAILY_CHOICES = [5, 8, 12, 20]
const CAP_CHOICES = [8, 12, 20, 40]
const THEMES: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: '기기 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

export function SettingsScreen() {
  const ready = useApp((s) => s.ready)
  const settings = useApp((s) => s.settings)
  const entities = useApp((s) => s.entities)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!ready) return <p className="set__wait">읽는 중이에요…</p>

  const update = useApp.getState().updateSettings

  const toggleTrack = (track: Track) => {
    const has = settings.tracks.includes(track)
    const next = has ? settings.tracks.filter((each) => each !== track) : [...settings.tracks, track]
    // 하나도 안 고르면 세션이 늘 0장이 된다. 마지막 하나는 끄지 못하게 한다.
    if (next.length === 0) {
      setNotice('트랙은 하나 이상 골라야 해요.')
      return
    }
    update({ tracks: TRACKS.filter((each) => next.includes(each)) })
  }

  const exportBackup = () => {
    const backup = buildBackup({
      reviews: entities.reviews,
      days: entities.days,
      sentences: entities.sentences,
      settings,
      now: new Date().toISOString(),
    })
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFileName(new Date())
    link.click()
    URL.revokeObjectURL(url)
    setNotice(`복습 ${backup.reviews.length}개, 기록 ${backup.days.length}일을 내려받았어요.`)
  }

  const importBackup = async (file: File) => {
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setNotice(`가져오지 못했어요: ${result.reason}`)
      return
    }
    const { backup } = result
    useApp.getState().commit({
      puts: {
        reviews: backup.reviews,
        days: backup.days,
        sentences: backup.customSentences,
      },
      deletes: {},
    })
    update(backup.settings)
    setNotice(`복습 ${backup.reviews.length}개, 기록 ${backup.days.length}일을 가져왔어요.`)
  }

  const eraseAll = async () => {
    if (!window.confirm('학습 기록을 전부 지울까요? 되돌릴 수 없어요. (문장은 그대로 남아요)')) return
    await clearProgress(db)
    await useApp.getState().reload()
    setNotice('학습 기록을 지웠어요.')
  }

  return (
    <main className="set has-dock">
      <h1 className="set__head">설정</h1>

      {notice !== null ? (
        <p className="set__notice" role="status">
          {notice}
        </p>
      ) : null}

      <Row title="하루 분량" hint="한 세션에 넣을 카드 수. 카드 한 장이 4박자라 8장이면 10분쯤 걸려요.">
        <Pills
          name="하루 분량"
          options={DAILY_CHOICES.map((value) => ({ value, label: `${value}장` }))}
          current={settings.dailyCount}
          onPick={(value) => update({ dailyCount: value })}
        />
      </Row>

      <Row title="밀린 복습 상한" hint="며칠 비웠을 때 한 세션에 몰아 넣을 최대 장수예요.">
        <Pills
          name="밀린 복습 상한"
          options={CAP_CHOICES.map((value) => ({ value, label: `${value}장` }))}
          current={settings.catchUpCap}
          onPick={(value) => update({ catchUpCap: value })}
        />
      </Row>

      <Row title="기준 음원 속도">
        <Pills
          name="기준 음원 속도"
          options={[0.75, 1].map((value) => ({ value, label: `${value}×` }))}
          current={settings.speed}
          onPick={(value) => update({ speed: value })}
        />
      </Row>

      <Row title="연습할 트랙" hint="고른 트랙의 문장만 세션에 나와요.">
        <ul className="set__tracks">
          {TRACKS.map((track) => {
            const on = settings.tracks.includes(track)
            const count = Object.values(entities.sentences).filter((row) => row.track === track).length
            return (
              <li key={track}>
                <button
                  type="button"
                  className={`set__track${on ? ' set__track--on' : ''}`}
                  aria-pressed={on}
                  disabled={count === 0}
                  onClick={() => toggleTrack(track)}
                >
                  <span>{TRACK_LABELS[track]}</span>
                  <span className="set__track-count tnum">{count}장</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Row>

      <Row title="화면">
        <Pills
          name="화면"
          options={THEMES.map(({ value, label }) => ({ value, label }))}
          current={settings.theme}
          onPick={(value) => update({ theme: value })}
        />
      </Row>

      <Row title="내 문장" hint="번들에 없는 문장을 직접 넣어요. 넣은 문장은 브라우저 음성으로 읽어요.">
        <Link className="btn" to="/sentences">
          문장 추가·편집
        </Link>
      </Row>

      <Row title="백업" hint="복습 기록과 설정만 담아요. 녹음은 들어가지 않아요.">
        <div className="set__buttons">
          <button type="button" className="btn" onClick={exportBackup}>
            내보내기
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            가져오기
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            // 눈에 보이는 '가져오기' 버튼이 이걸 대신 누른다. 그래도 이름은 있어야 한다.
            aria-label="백업 파일 고르기"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importBackup(file)
              event.target.value = ''
            }}
          />
        </div>
      </Row>

      <Row title="전체 삭제" hint="복습 기록·세션·녹음을 지워요. 문장은 그대로 남아요.">
        <button type="button" className="btn btn--danger" onClick={() => void eraseAll()}>
          학습 기록 지우기
        </button>
      </Row>
    </main>
  )
}

interface RowProps {
  title: string
  hint?: string
  children: ReactNode
}

function Row({ title, hint, children }: RowProps) {
  return (
    <section className="set__row">
      <h2 className="set__title">{title}</h2>
      {hint ? <p className="set__hint">{hint}</p> : null}
      <div className="set__body">{children}</div>
    </section>
  )
}

interface PillsProps<T extends string | number> {
  /** 묶음 이름. 같은 글자('12장')가 여러 줄에 나오므로 소리로도 구분돼야 한다. */
  name: string
  options: readonly { value: T; label: string }[]
  current: T
  onPick: (value: T) => void
}

function Pills<T extends string | number>({ name, options, current, onPick }: PillsProps<T>) {
  return (
    <div className="pills" role="group" aria-label={name}>
      {options.map(({ value, label }) => (
        <button
          key={String(value)}
          type="button"
          className={`pills__pick${value === current ? ' pills__pick--on' : ''}`}
          aria-pressed={value === current}
          onClick={() => onPick(value)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
