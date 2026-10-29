import { emptyEntityState, keyOf, TABLE_NAMES } from '../store/changes'
import type { ChangeSet, EntityState, TableMap, TableName } from '../store/changes'
import type { Recording, Settings } from '../domain/types'
import type { GosayDB } from './db'

/** 문장 하나에 남겨 두는 녹음 수. 넘치면 오래된 것부터 지운다. */
export const RECORDINGS_PER_SENTENCE = 3

export interface LoadedData {
  entities: EntityState
  settings: Settings | null
}

export async function loadAll(db: GosayDB): Promise<LoadedData> {
  const entities = emptyEntityState() as { [K in TableName]: Record<string, TableMap[K]> }
  // 모든 테이블을 한 읽기 트랜잭션으로 읽는다. 따로 읽으면 읽는 도중 들어온 쓰기 때문에
  // 테이블끼리 시점이 어긋난 스냅샷(세션은 있는데 그 문장이 없음)이 만들어질 수 있다.
  const settings = await db.transaction(
    'r',
    [...TABLE_NAMES.map((t) => db.table(t)), db.settings],
    async () => {
      await Promise.all(
        TABLE_NAMES.map(async (name) => {
          const rows = (await db.table(name).toArray()) as TableMap[typeof name][]
          const table: Record<string, TableMap[typeof name]> = {}
          for (const row of rows) table[keyOf(name, row)] = row
          ;(entities as Record<string, unknown>)[name] = table
        }),
      )
      return (await db.settings.get('settings')) ?? null
    },
  )
  return { entities, settings }
}

/** 변경 집합을 한 트랜잭션으로 기록한다. 일부만 저장된 상태를 만들지 않으려는 것이다. */
export async function persistChanges(db: GosayDB, cs: ChangeSet): Promise<void> {
  const tables = TABLE_NAMES.filter((t) => (cs.puts[t]?.length ?? 0) > 0 || (cs.deletes[t]?.length ?? 0) > 0)
  if (tables.length === 0) return
  await db.transaction(
    'rw',
    tables.map((t) => db.table(t)),
    async () => {
      for (const t of tables) {
        const table = db.table(t)
        const dels = cs.deletes[t]
        if (dels?.length) await table.bulkDelete([...dels])
        const puts = cs.puts[t]
        if (puts?.length) await table.bulkPut([...puts])
      }
    },
  )
}

export async function persistSettings(db: GosayDB, settings: Settings): Promise<void> {
  await db.settings.put(settings)
}

/**
 * 녹음을 저장하고 그 문장의 오래된 녹음을 정리한다.
 * 녹음은 용량이 커서 그냥 쌓으면 IndexedDB 가 수십 MB 로 자란다.
 */
export async function saveRecording(db: GosayDB, recording: Recording): Promise<void> {
  await db.transaction('rw', db.recordings, async () => {
    await db.recordings.put(recording)
    const mine = await db.recordings.where('sentenceId').equals(recording.sentenceId).toArray()
    const stale = mine
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(RECORDINGS_PER_SENTENCE)
      .map((row) => row.id)
    if (stale.length > 0) await db.recordings.bulkDelete(stale)
  })
}

/** 그 문장의 가장 최근 녹음. 없으면 null. */
export async function latestRecording(db: GosayDB, sentenceId: string): Promise<Recording | null> {
  const mine = await db.recordings.where('sentenceId').equals(sentenceId).toArray()
  if (mine.length === 0) return null
  return mine.reduce((latest, row) => (row.createdAt > latest.createdAt ? row : latest))
}

/** 학습 기록을 전부 지운다(설정의 '전체 삭제'). 문장 자체는 코퍼스에서 다시 심어진다. */
export async function clearProgress(db: GosayDB): Promise<void> {
  await db.transaction('rw', [db.reviews, db.sessions, db.days, db.recordings], async () => {
    await Promise.all([db.reviews.clear(), db.sessions.clear(), db.days.clear(), db.recordings.clear()])
  })
}
