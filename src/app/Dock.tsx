// 아래 독. 세션 화면에는 나오지 않는다 — 거기서 나가는 길은 '접기' 하나뿐이다.
import { NavLink } from 'react-router-dom'
import { BarChart3, Home, Layers, Settings } from 'lucide-react'
import './dock.css'

const TABS = [
  { to: '/', label: '오늘', Icon: Home },
  { to: '/tracks', label: '묶음', Icon: Layers },
  { to: '/stats', label: '기록', Icon: BarChart3 },
  { to: '/settings', label: '설정', Icon: Settings },
] as const

export function Dock() {
  return (
    <nav className="dock" aria-label="화면 이동">
      <ul className="dock__list">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) => `dock__tab${isActive ? ' dock__tab--on' : ''}`}
            >
              <Icon aria-hidden size={20} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
