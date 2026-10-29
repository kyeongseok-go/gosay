import { GosayDB } from '../db/db'
import { createAppStore } from './store'

/** 앱이 실제로 쓰는 DB 와 저장소. 테스트는 createAppStore 로 따로 만든다. */
export const db = new GosayDB()
export const useApp = createAppStore(db)
