import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { GosayDB } from '../db/db'
import { loadAll, persistChanges, persistSettings } from '../db/persist'
import { corpus } from '../domain/corpus'
import { dayKeyOf } from '../domain/date'
import { nextReview, startingReview } from '../domain/review'
import {
  advanceBeat,
  buildSession,
  currentSentenceId,
  isFinished,
  stuckIds,
  submitGrade,
} from '../domain/session'
import type { DayLog, Grade, Sentence, Session, Settings } from '../domain/types'
import { applyChangeSet, emptyEntityState, isEmptyChangeSet, mergeChangeSets } from './changes'
import type { ChangeSet, EntityState } from './changes'
import { defaultSettings, mergeSettings } from './defaults'

/** 저장 실패 시 총 시도 횟수와 사이에 쉬는 시간 */
const WRITE_ATTEMPTS = 3
const WRITE_RETRY_MS = 200

export interface AppState {
  ready: boolean
  entities: EntityState
  settings: Settings
  /** 저장에 실패하면 문구가 채워진다. 사용자가 닫을 때까지 남는다. */
  persistError: string | null
  /** 처음 읽기에 실패했을 때의 문구. 화면 전체를 오류 안내로 바꾼다. */
  loadError: string | null
  /** 아직 IndexedDB 에 쓰는 중인 변경 수. 0 이 아니면 탭을 닫으면 안 된다. */
  pendingWrites: number
  load: () => Promise<void>
  /** 캐시를 무시하고 DB 에서 다시 읽는다. 가져오기·전체 삭제 뒤와 테스트가 쓴다. */
  reload: () => Promise<void>
  /** 진행 중인 쓰기가 끝날 때까지 기다린다. 테스트와 '지금 저장됐나' 표시가 쓴다. */
  settled: () => Promise<void>
  /** 모든 쓰기가 지나가는 한 경로. 메모리와 IndexedDB 가 함께 움직인다. */
  commit: (cs: ChangeSet) => void
  updateSettings: (patch: Partial<Settings>) => void
  dismissError: () => void

  /** 오늘의 세션을 새로 짠다. 이미 끝나지 않은 세션이 있으면 그것을 그대로 이어 쓴다. */
  startSession: () => Session | null
  /**
   * 고른 문장만으로 세션을 짠다(묶음 연습). 복습일이 안 됐어도 넣는다 —
   * 면접 직전에 '못 들었을 때' 만 돌리고 싶은 경우가 이 길이다. 열려 있던 세션은 닫는다.
   */
  startSessionOf: (sentenceIds: readonly string[]) => Session | null
  /** 한 박자 앞으로. **매번 저장한다** — 지하철에서 앱이 닫혀도 이 자리로 돌아온다. */
  nextBeat: () => void
  /** 지금 카드를 채점하고 다음 카드로. 복습 간격과 날짜 기록이 함께 갱신된다. */
  grade: (grade: Grade) => void
  /** 세션을 지금 접는다. 남은 카드는 다음에 다시 나온다. */
  endSession: () => void
}

export type AppStore = UseBoundStore<StoreApi<AppState>>

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류'
}

/**
 * 저장을 몇 번 더 시도한다. 한 번 실패한 쓰기는 다시 쓰지 않으므로 메모리와 DB 가 영구히 어긋난다.
 * IndexedDB 는 일시적인 잠금으로 실패할 수 있어, 짧게 쉬고 다시 해 보면 대개 성공한다.
 */
async function withRetry(work: () => Promise<void>, attempts = WRITE_ATTEMPTS): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await work()
      return
    } catch (error: unknown) {
      if (attempt >= attempts) throw error
      await new Promise((resolve) => setTimeout(resolve, WRITE_RETRY_MS * attempt))
    }
  }
}

/**
 * 번들 코퍼스를 저장된 문장과 맞춘다.
 * 코퍼스가 원천이라 내용이 바뀌면 덮어쓰지만, **사람이 앱에서 고친 문장(custom)은 건드리지 않는다.**
 * 지우기도 하지 않는다 — 복습 기록이 남은 문장을 조용히 없애면 기록이 가리킬 곳을 잃는다.
 */
export function corpusChanges(stored: Readonly<Record<string, Sentence>>, bundled: readonly Sentence[]): ChangeSet {
  const puts = bundled.filter((row) => {
    const before = stored[row.id]
    if (before?.custom) return false
    return (
      before === undefined ||
      before.ko !== row.ko ||
      before.en !== row.en ||
      before.note !== row.note ||
      before.source !== row.source ||
      before.group !== row.group ||
      before.track !== row.track ||
      before.audio !== row.audio
    )
  })
  return puts.length > 0 ? { puts: { sentences: puts }, deletes: {} } : { puts: {}, deletes: {} }
}

/**
 * 어제 열어 둔 세션을 닫는다. 지난 날의 세션을 이어 쓰게 하면 그날 몫과 오늘 몫이 섞인다.
 * 거기서 채점한 것은 이미 복습 간격에 반영돼 있으므로 잃는 것은 없다.
 */
export function staleSessionChanges(
  sessions: Readonly<Record<string, Session>>,
  today: string,
): ChangeSet {
  const stale = Object.values(sessions)
    .filter((row) => row.finishedAt === null && row.date !== today)
    .map((row) => ({ ...row, finishedAt: `${row.date}T23:59:59.999Z` }))
  return stale.length > 0 ? { puts: { sessions: stale }, deletes: {} } : { puts: {}, deletes: {} }
}

/** 오늘 기록에 결과 하나를 더한다. 행이 없으면 만든다. */
export function bumpDay(days: Readonly<Record<string, DayLog>>, today: string, grade: Grade): DayLog {
  const before = days[today] ?? { date: today, spoken: 0, stuck: 0 }
  return {
    date: today,
    spoken: before.spoken + 1,
    stuck: before.stuck + (grade === 'stuck' ? 1 : 0),
  }
}

export interface StoreOptions {
  /** 테스트에서 코퍼스를 갈아 끼울 수 있게 열어 둔다. */
  sentences?: readonly Sentence[]
}

export function createAppStore(db: GosayDB, now: () => number = Date.now, options: StoreOptions = {}): AppStore {
  const bundled = options.sentences ?? corpus()

  return create<AppState>((set, get) => {
    /** 진행 중인 쓰기. settled() 가 이걸 기다린다. */
    const inFlight = new Set<Promise<void>>()

    /** 모든 쓰기가 이 래퍼를 지난다: 진행 수를 세고, 실패는 사용자가 닫을 때까지 남긴다. */
    const track = (work: () => Promise<void>, failure: (error: unknown) => string): void => {
      set((s) => ({ pendingWrites: s.pendingWrites + 1 }))
      const running = withRetry(work)
        .catch((error: unknown) => {
          set((s) => ({ persistError: s.persistError ?? failure(error) }))
        })
        .finally(() => {
          inFlight.delete(running)
          set((s) => ({ pendingWrites: Math.max(0, s.pendingWrites - 1) }))
        })
      inFlight.add(running)
    }

    const commit = (cs: ChangeSet): void => {
      if (isEmptyChangeSet(cs)) return
      set({ entities: applyChangeSet(get().entities, cs) })
      // 먼저 난 오류를 덮어쓰지 않는다. 처음 원인이 가장 중요하다.
      track(
        () => persistChanges(db, cs),
        (error) => `저장하지 못했어요. 이 탭을 닫으면 방금 한 것이 사라질 수 있어요. (${describeError(error)})`,
      )
    }

    /** 지금 이어 쓸 수 있는 세션. 오늘 날짜이고 아직 끝나지 않은 것. */
    const openSession = (today: string): Session | null => {
      const rows = Object.values(get().entities.sessions)
      return rows.find((row) => row.date === today && row.finishedAt === null) ?? null
    }

    const initialize = async (): Promise<void> => {
      const loaded = await loadAll(db)
      const settings = mergeSettings(loaded.settings)
      if (!loaded.settings) await persistSettings(db, settings)

      // 번들 코퍼스를 DB 에 맞추고, 어제 열어 둔 세션은 닫는다.
      // 닫지 않으면 "열려 있는 세션" 이 둘이 되고 화면이 어느 것을 보여 줄지 알 수 없다.
      const sync = mergeChangeSets(
        corpusChanges(loaded.entities.sentences, bundled),
        staleSessionChanges(loaded.entities.sessions, dayKeyOf(now())),
      )
      if (!isEmptyChangeSet(sync)) await persistChanges(db, sync)
      const entities = applyChangeSet(loaded.entities, sync)

      set({ entities, settings, ready: true, loadError: null })
    }

    // load() 가 여러 번 불려도(React StrictMode) 실제 읽기는 한 번만 한다.
    let initializing: Promise<void> | null = null
    const start = (): Promise<void> => {
      const run = initialize().catch((error: unknown) => {
        initializing = null
        set({ loadError: `저장된 데이터를 읽지 못했어요. (${describeError(error)})` })
        throw error
      })
      initializing = run
      return run
    }

    return {
      ready: false,
      entities: emptyEntityState(),
      settings: defaultSettings(),
      persistError: null,
      loadError: null,
      pendingWrites: 0,

      load: () => initializing ?? start(),
      reload: () => start(),

      // 쓰기가 끝나면서 또 쓰기가 생길 수 있어(설정 저장 등) 비어질 때까지 돈다.
      settled: async () => {
        while (inFlight.size > 0) await Promise.allSettled([...inFlight])
      },
      commit,
      dismissError: () => set({ persistError: null }),

      updateSettings: (patch) => {
        const settings = { ...get().settings, ...patch }
        set({ settings })
        track(
          () => persistSettings(db, settings),
          (error) => `설정을 저장하지 못했어요. (${describeError(error)})`,
        )
      },

      startSession: () => {
        const stamp = now()
        const today = dayKeyOf(stamp)
        const existing = openSession(today)
        if (existing) return existing

        const { entities, settings } = get()
        const session = buildSession({
          id: `sess-${stamp}`,
          today,
          startedAt: new Date(stamp).toISOString(),
          sentences: Object.values(entities.sentences),
          reviews: entities.reviews,
          dailyCount: settings.dailyCount,
          catchUpCap: settings.catchUpCap,
          tracks: settings.tracks,
        })
        commit({ puts: { sessions: [session] }, deletes: {} })
        return session
      },

      startSessionOf: (sentenceIds) => {
        const stamp = now()
        const today = dayKeyOf(stamp)
        const { entities, settings } = get()
        const open = openSession(today)
        const startedAt = new Date(stamp).toISOString()

        // 복습일이 지난 것부터. 같은 묶음 안에서도 밀린 것을 먼저 본다.
        const ordered = [...sentenceIds]
          .filter((id) => entities.sentences[id] !== undefined)
          .sort((a, b) => (entities.reviews[a]?.due ?? '').localeCompare(entities.reviews[b]?.due ?? ''))
          .slice(0, settings.dailyCount)

        const session: Session = {
          id: `sess-${stamp}`,
          date: today,
          sentenceIds: ordered,
          index: 0,
          beat: 'listen',
          grades: {},
          startedAt,
          finishedAt: ordered.length === 0 ? startedAt : null,
        }

        commit(
          mergeChangeSets(
            open ? { puts: { sessions: [{ ...open, finishedAt: startedAt }] }, deletes: {} } : { puts: {}, deletes: {} },
            { puts: { sessions: [session] }, deletes: {} },
          ),
        )
        return session
      },

      nextBeat: () => {
        const today = dayKeyOf(now())
        const session = openSession(today)
        if (!session) return
        const next = advanceBeat(session)
        // 같은 박자면 쓰지 않는다. 마지막 박자에서 버튼을 눌러도 쓰기가 생기지 않게.
        if (next === session) return
        commit({ puts: { sessions: [next] }, deletes: {} })
      },

      grade: (grade) => {
        const stamp = now()
        const today = dayKeyOf(stamp)
        const session = openSession(today)
        if (!session) return
        const sentenceId = currentSentenceId(session)
        if (sentenceId === null) return

        const before = get().entities.reviews[sentenceId] ?? startingReview(sentenceId, today)
        const review = nextReview(before, grade, today)
        const next = submitGrade(session, grade, new Date(stamp).toISOString())
        const day = bumpDay(get().entities.days, today, grade)

        commit(
          mergeChangeSets(
            { puts: { reviews: [review] }, deletes: {} },
            { puts: { sessions: [next] }, deletes: {} },
            { puts: { days: [day] }, deletes: {} },
          ),
        )
      },

      endSession: () => {
        const stamp = now()
        const today = dayKeyOf(stamp)
        const session = openSession(today)
        if (!session) return
        // 끝까지 간 세션은 이미 finishedAt 이 있다. 중간에 접는 경우만 지금 시각으로 닫는다.
        const closed: Session = {
          ...session,
          finishedAt: isFinished(session) ? session.finishedAt : new Date(stamp).toISOString(),
        }
        commit({ puts: { sessions: [closed] }, deletes: {} })
      },
    }
  })
}

/** 세션 끝 요약에 쓰는 값. 화면이 직접 계산하지 않게 한곳에 둔다. */
export function sessionSummary(
  session: Session,
  sentences: Readonly<Record<string, Sentence>>,
): { spoken: number; stuck: readonly Sentence[] } {
  const stuck = stuckIds(session)
    .map((id) => sentences[id])
    .filter((row): row is Sentence => row !== undefined)
  return { spoken: Object.keys(session.grades).length, stuck }
}
