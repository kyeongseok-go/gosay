import { useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { useApp } from '../store/app'
import { Today } from '../features/today/Today'
import { SessionScreen } from '../features/session/SessionScreen'
import './app.css'

export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}

function Shell() {
  const load = useApp((s) => s.load)
  const loadError = useApp((s) => s.loadError)
  const persistError = useApp((s) => s.persistError)
  const theme = useApp((s) => s.settings.theme)

  useEffect(() => {
    void load()
  }, [load])

  // 'auto' 면 속성을 지워 운영체제 설정을 따른다.
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])

  if (loadError !== null) {
    return (
      <main className="fault">
        <h1>데이터를 읽지 못했어요</h1>
        <p>{loadError}</p>
        <p className="fault__why">
          사생활 보호 창에서는 저장소를 쓸 수 없어요. 일반 창에서 다시 열어 주세요.
        </p>
      </main>
    )
  }

  return (
    <>
      {persistError !== null ? (
        <div className="warn" role="alert">
          <p>{persistError}</p>
          <button type="button" onClick={() => useApp.getState().dismissError()}>
            닫기
          </button>
        </div>
      ) : null}
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/session" element={<SessionScreen />} />
        <Route path="*" element={<Today />} />
      </Routes>
    </>
  )
}
