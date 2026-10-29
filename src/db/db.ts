import Dexie, { type EntityTable } from 'dexie'
import type { DayLog, Recording, Review, Session, Settings } from '../domain/types'

/** 다른 탭이 DB 버전을 올려서 이 탭의 연결이 닫혔을 때 알리는 이벤트 */
export const DB_STALE_EVENT = 'gosay:db-stale'

export class GosayDB extends Dexie {
  sentences!: EntityTable<import('../domain/types').Sentence, 'id'>
  reviews!: EntityTable<Review, 'sentenceId'>
  sessions!: EntityTable<Session, 'id'>
  days!: EntityTable<DayLog, 'date'>
  recordings!: EntityTable<Recording, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor(name = 'gosay') {
    super(name)
    // 다른 탭이 새 버전으로 올라가려 하면 연결을 닫아 주고 이 탭에는 새로고침을 안내한다.
    // 그냥 두면 업그레이드가 막히고 오래된 탭이 낡은 데이터를 계속 쓴다.
    this.on('versionchange', () => {
      this.close()
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(DB_STALE_EVENT))
    })
    // 인덱스는 실제로 조회에 쓰는 것만 둔다. 스키마를 바꿀 때는 version 을 올리고 upgrade 를 붙인다.
    this.version(1).stores({
      sentences: 'id, track, group, custom',
      reviews: 'sentenceId, due, stuckCount',
      sessions: 'id, date, finishedAt',
      days: 'date',
      recordings: 'id, sentenceId, createdAt',
      settings: 'id',
    })
  }
}
