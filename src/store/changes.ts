// 변경 집합(ChangeSet): 모든 쓰기가 지나가는 한 경로.
// 화면 어디서 무엇을 바꾸든 `commit(변경집합, '라벨')` 하나로 끝나고, 메모리와 IndexedDB 가
// 같은 모양으로 함께 움직인다. 쓰기 경로가 여럿이면 둘이 조용히 어긋나고, 그건 다음 날 아침에만 보인다.
//
// 녹음(Blob)은 여기 들어오지 않는다. 용량이 크고 내보내기에서도 빠지므로 별도 경로로 다룬다.
import type { DayLog, Review, Sentence, Session } from '../domain/types'

export interface TableMap {
  sentences: Sentence
  reviews: Review
  sessions: Session
  days: DayLog
}

export type TableName = keyof TableMap

export const TABLE_NAMES: readonly TableName[] = ['sentences', 'reviews', 'sessions', 'days']

export type EntityState = { [K in TableName]: Readonly<Record<string, TableMap[K]>> }

export interface ChangeSet {
  puts: { [K in TableName]?: ReadonlyArray<TableMap[K]> }
  deletes: { [K in TableName]?: readonly string[] }
}

export function emptyEntityState(): EntityState {
  return { sentences: {}, reviews: {}, sessions: {}, days: {} }
}

/** 테이블마다 키가 되는 필드가 다르다. 한곳에 모아 둬야 영속화와 메모리가 같은 키를 쓴다. */
export function keyOf<K extends TableName>(table: K, entity: TableMap[K]): string {
  if (table === 'reviews') return (entity as Review).sentenceId
  if (table === 'days') return (entity as DayLog).date
  return (entity as { id: string }).id
}

export function isEmptyChangeSet(cs: ChangeSet): boolean {
  return TABLE_NAMES.every((t) => (cs.puts[t]?.length ?? 0) === 0 && (cs.deletes[t]?.length ?? 0) === 0)
}

/** 상태에 변경을 적용한다. 원본은 건드리지 않고 바뀐 테이블만 새 객체로 교체한다. */
export function applyChangeSet(state: EntityState, cs: ChangeSet): EntityState {
  const next: { [K in TableName]: Record<string, TableMap[K]> } = { ...state } as never

  for (const t of TABLE_NAMES) {
    const puts = cs.puts[t] as ReadonlyArray<TableMap[typeof t]> | undefined
    const dels = cs.deletes[t]
    if (!puts?.length && !dels?.length) continue

    const table = { ...(state[t] as Record<string, TableMap[typeof t]>) }
    for (const id of dels ?? []) delete table[id]
    for (const entity of puts ?? []) table[keyOf(t, entity)] = entity
    ;(next as Record<string, unknown>)[t] = table
  }

  return next as EntityState
}

/** 여러 변경을 하나로 합친다(나중 것이 우선). 한 동작이 여러 테이블을 건드릴 때 쓴다. */
export function mergeChangeSets(...sets: ChangeSet[]): ChangeSet {
  const puts: Partial<Record<TableName, Map<string, unknown>>> = {}
  const deletes: Partial<Record<TableName, Set<string>>> = {}

  for (const cs of sets) {
    for (const t of TABLE_NAMES) {
      for (const entity of (cs.puts[t] ?? []) as ReadonlyArray<TableMap[typeof t]>) {
        const key = keyOf(t, entity)
        ;(puts[t] ??= new Map()).set(key, entity)
        deletes[t]?.delete(key)
      }
      for (const id of cs.deletes[t] ?? []) {
        puts[t]?.delete(id)
        ;(deletes[t] ??= new Set()).add(id)
      }
    }
  }

  const out: { puts: Record<string, unknown[]>; deletes: Record<string, string[]> } = { puts: {}, deletes: {} }
  for (const t of TABLE_NAMES) {
    if (puts[t]?.size) out.puts[t] = [...puts[t].values()]
    if (deletes[t]?.size) out.deletes[t] = [...deletes[t]]
  }
  return out as unknown as ChangeSet
}
