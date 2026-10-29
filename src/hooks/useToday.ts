import { useEffect, useState } from 'react'
import { dayKeyOf } from '../domain/date'
import type { DayKey } from '../domain/date'

/**
 * 오늘 날짜. 렌더 중에 `Date.now()` 를 부르지 않으려고 상태로 둔다.
 *
 * 다시 읽는 시점이 중요하다: 설치한 PWA 는 몇 날 며칠 열린 채로 남는다.
 * 자기 전에 열어 두고 아침에 다시 보면 날짜가 바뀌어 있어야 "기다리는 문장"이 맞게 나온다.
 */
export function useToday(): DayKey {
  const [today, setToday] = useState(() => dayKeyOf(Date.now()))

  useEffect(() => {
    const check = () => {
      const now = dayKeyOf(Date.now())
      setToday((before) => (before === now ? before : now))
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}
