import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { GosayDB } from '../db/db'
import { bumpDay, corpusChanges, createAppStore, sessionSummary } from './store'
import { isEmptyChangeSet } from './changes'
import { currentSentenceId } from '../domain/session'
import type { AppStore } from './store'
import type { Sentence } from '../domain/types'

function sentence(id: string, patch: Partial<Sentence> = {}): Sentence {
  return {
    id,
    track: 'interview',
    group: '경력 설명',
    ko: `한국어 ${id}`,
    en: `english ${id}`,
    note: '',
    source: '테스트',
    audio: `audio/${id}.m4a`,
    custom: false,
    ...patch,
  }
}

const CORPUS = [sentence('a'), sentence('b'), sentence('c')]
/** 2026-10-29 09:00 지역 시간 */
const STAMP = new Date(2026, 9, 29, 9, 0, 0).getTime()

let db: GosayDB
let store: AppStore
let clock = STAMP

beforeEach(async () => {
  clock = STAMP
  db = new GosayDB(`test-${Math.random().toString(36).slice(2)}`)
  store = createAppStore(db, () => clock, { sentences: CORPUS })
  await store.getState().load()
})

afterEach(async () => {
  await db.delete()
})

describe('load', () => {
  test('번들 코퍼스가 저장소에 심어진다', () => {
    const { entities, ready } = store.getState()

    expect(ready).toBe(true)
    expect(Object.keys(entities.sentences).sort()).toEqual(['a', 'b', 'c'])
  })

  test('설정 기본값이 저장된다', async () => {
    const stored = await db.settings.get('settings')

    expect(stored?.dailyCount).toBeGreaterThan(0)
    expect(stored?.tracks).toEqual(['interview'])
  })

  test('두 번 불러도 한 번만 읽는다', async () => {
    const first = store.getState().load()
    const second = store.getState().load()

    expect(first).toBe(second)
    await first
  })
})

describe('startSession', () => {
  test('카드가 담긴 세션이 생기고 저장된다', async () => {
    const session = store.getState().startSession()

    expect(session?.sentenceIds).toEqual(['a', 'b', 'c'])
    await store.getState().settled()
    const stored = await db.sessions.toArray()
    expect(stored).toHaveLength(1)
  })

  test('끝나지 않은 세션이 있으면 새로 짜지 않고 그것을 잇는다 — 중단 복원', () => {
    const first = store.getState().startSession()
    store.getState().nextBeat()
    const again = store.getState().startSession()

    expect(again?.id).toBe(first?.id)
    expect(Object.keys(store.getState().entities.sessions)).toHaveLength(1)
  })
})

describe('nextBeat', () => {
  test('박자가 하나씩 앞으로 가고 매번 저장된다', async () => {
    const session = store.getState().startSession()
    store.getState().nextBeat()

    await store.getState().settled()
    const stored = await db.sessions.get(session?.id ?? '')
    expect(stored?.beat).toBe('shadow')
  })

  test('마지막 박자에서는 더 가지 않는다', () => {
    store.getState().startSession()
    for (let i = 0; i < 6; i += 1) store.getState().nextBeat()

    const session = Object.values(store.getState().entities.sessions)[0]
    expect(session.beat).toBe('compare')
    expect(session.index).toBe(0)
  })

  test('세션이 없으면 아무 일도 없다', () => {
    store.getState().nextBeat()

    expect(Object.keys(store.getState().entities.sessions)).toHaveLength(0)
  })
})

describe('grade', () => {
  test('복습 간격·세션·날짜 기록이 한 번에 갱신된다', async () => {
    store.getState().startSession()
    store.getState().grade('fluent')

    const { entities } = store.getState()
    expect(entities.reviews.a.lastGrade).toBe('fluent')
    expect(entities.reviews.a.due).toBe('2026-10-31')
    expect(entities.days['2026-10-29'].spoken).toBe(1)
    expect(Object.values(entities.sessions)[0].index).toBe(1)

    await store.getState().settled()
    const stored = await db.reviews.get('a')
    expect(stored?.due).toBe('2026-10-31')
  })

  test('막히면 날짜 기록의 막힘 수가 늘고 그 문장이 세션 끝에 다시 붙는다', () => {
    store.getState().startSession()
    store.getState().grade('stuck')

    const { entities } = store.getState()
    expect(entities.days['2026-10-29'].stuck).toBe(1)
    expect(Object.values(entities.sessions)[0].sentenceIds).toEqual(['a', 'b', 'c', 'a'])
  })

  test('마지막 카드를 채점하면 세션이 닫히고 새 세션을 짤 수 있다', () => {
    store.getState().startSession()
    store.getState().grade('fluent')
    store.getState().grade('fluent')
    store.getState().grade('fluent')

    const done = Object.values(store.getState().entities.sessions)[0]
    expect(done.finishedAt).not.toBeNull()

    clock = STAMP + 60_000
    const next = store.getState().startSession()
    expect(next?.id).not.toBe(done.id)
  })

  test('세션이 없으면 아무 일도 없다', () => {
    store.getState().grade('fluent')

    expect(store.getState().entities.reviews).toEqual({})
  })
})

describe('endSession', () => {
  test('중간에 접어도 닫히고, 남은 카드는 다음 세션에 다시 나온다', () => {
    store.getState().startSession()
    store.getState().grade('fluent')
    store.getState().endSession()

    const closed = Object.values(store.getState().entities.sessions)[0]
    expect(closed.finishedAt).not.toBeNull()

    clock = STAMP + 60_000
    const next = store.getState().startSession()
    // a 는 이틀 뒤로 밀렸으니 남은 b·c 가 나온다
    expect(next?.sentenceIds).toEqual(['b', 'c'])
  })

  test('세션이 없으면 아무 일도 없다', () => {
    store.getState().endSession()

    expect(Object.keys(store.getState().entities.sessions)).toHaveLength(0)
  })
})

describe('updateSettings', () => {
  test('설정이 메모리와 DB 에 같이 반영된다', async () => {
    store.getState().updateSettings({ dailyCount: 3, speed: 0.75 })

    expect(store.getState().settings.dailyCount).toBe(3)
    await store.getState().settled()
    const stored = await db.settings.get('settings')
    expect(stored?.speed).toBe(0.75)
  })

  test('하루 분량을 줄이면 다음 세션이 그만큼만 담는다', () => {
    store.getState().updateSettings({ dailyCount: 2 })
    const session = store.getState().startSession()

    expect(session?.sentenceIds).toHaveLength(2)
  })
})

describe('corpusChanges', () => {
  test('처음에는 전부 넣는다', () => {
    const cs = corpusChanges({}, CORPUS)

    expect(cs.puts.sentences).toHaveLength(3)
  })

  test('내용이 같으면 아무것도 쓰지 않는다 — 열 때마다 DB 를 긁지 않게', () => {
    const stored = Object.fromEntries(CORPUS.map((s) => [s.id, s]))

    expect(isEmptyChangeSet(corpusChanges(stored, CORPUS))).toBe(true)
  })

  test('문장이 고쳐지면 그 한 장만 덮는다', () => {
    const stored = Object.fromEntries(CORPUS.map((s) => [s.id, s]))
    const fixed = [sentence('a', { en: 'better english' }), stored.b, stored.c]

    const cs = corpusChanges(stored, fixed)

    expect(cs.puts.sentences).toHaveLength(1)
    expect(cs.puts.sentences?.[0].id).toBe('a')
  })

  test('사람이 앱에서 고친 문장은 코퍼스가 덮지 않는다', () => {
    const stored = { a: sentence('a', { ko: '내가 고친 한국어', custom: true }) }

    const cs = corpusChanges(stored, [sentence('a')])

    expect(isEmptyChangeSet(cs)).toBe(true)
  })

  test('코퍼스에서 빠진 문장을 지우지 않는다 — 복습 기록이 가리킬 곳을 잃는다', () => {
    const stored = Object.fromEntries(CORPUS.map((s) => [s.id, s]))

    const cs = corpusChanges(stored, [sentence('a')])

    expect(cs.deletes.sentences).toBeUndefined()
  })
})

describe('bumpDay', () => {
  test('행이 없으면 만든다', () => {
    expect(bumpDay({}, '2026-10-29', 'fluent')).toEqual({ date: '2026-10-29', spoken: 1, stuck: 0 })
  })

  test('막힘은 따로 센다', () => {
    const once = bumpDay({}, '2026-10-29', 'stuck')
    const twice = bumpDay({ '2026-10-29': once }, '2026-10-29', 'shaky')

    expect(twice).toEqual({ date: '2026-10-29', spoken: 2, stuck: 1 })
  })
})

describe('sessionSummary', () => {
  test('말한 수와 막힌 문장을 돌려준다', () => {
    store.getState().startSession()
    store.getState().grade('stuck')
    store.getState().grade('fluent')

    const session = Object.values(store.getState().entities.sessions)[0]
    const summary = sessionSummary(session, store.getState().entities.sentences)

    expect(summary.spoken).toBe(2)
    expect(summary.stuck.map((s) => s.id)).toEqual(['a'])
  })
})

describe('currentSentenceId 와 저장소가 같은 카드를 가리킨다', () => {
  test('채점할 때마다 다음 카드로 옮겨 간다', () => {
    store.getState().startSession()
    const first = Object.values(store.getState().entities.sessions)[0]
    expect(currentSentenceId(first)).toBe('a')

    store.getState().grade('fluent')
    const second = Object.values(store.getState().entities.sessions)[0]
    expect(currentSentenceId(second)).toBe('b')
  })
})
