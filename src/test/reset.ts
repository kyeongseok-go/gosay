import { db, useApp } from '../store/app'

/**
 * 컴포넌트 테스트는 앱이 실제로 쓰는 저장소(싱글턴)를 그대로 쓴다.
 * 그래야 "화면 → 저장소 → IndexedDB" 가 실제와 같은 경로로 돈다.
 * 대신 테스트마다 테이블을 비우고 다시 읽어 서로 섞이지 않게 한다.
 */
export async function resetApp(): Promise<void> {
  await Promise.all([
    db.sentences.clear(),
    db.reviews.clear(),
    db.sessions.clear(),
    db.days.clear(),
    db.recordings.clear(),
    db.settings.clear(),
  ])
  await useApp.getState().reload()
  await useApp.getState().settled()
}
