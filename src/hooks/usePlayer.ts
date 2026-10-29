// 음원 재생. 기준 음원과 내 녹음을 번갈아 재생하는 데 같은 것을 쓴다.
//
// iOS 제약: `speechSynthesis` 는 중간에 끊기고 음성 목록이 늦게 차서 기준 음원으로 못 쓴다.
// 그래서 기준 음원은 빌드 때 만들어 번들했고(`scripts/make-audio.mjs`), 여기서는 그 파일을 튼다.
// 사람이 추가한 문장만 음원이 없어서 런타임 TTS 로 대체한다.
import { useCallback, useEffect, useRef, useState } from 'react'

/** 지금 무엇을 틀고 있나. A/B 대조에서 버튼 두 개 중 어느 쪽이 켜졌는지 보여 준다. */
export type PlayingWhat = string | null

export interface PlayerHandle {
  playing: PlayingWhat
  /** `key` 는 버튼을 구별하는 이름이다('기준', '내 녹음'). */
  play: (src: string, key: string, rate?: number) => void
  stop: () => void
  /** 음원이 없는 문장을 브라우저 음성으로 읽는다. 없으면 아무 일도 안 한다. */
  speak: (text: string, key: string, rate?: number) => void
}

export function usePlayer(): PlayerHandle {
  const [playing, setPlaying] = useState<PlayingWhat>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  // 요소는 한 번만 만들고 재생마다 src 만 갈아 끼운다.
  // iOS 는 사용자 제스처 안에서 만든 요소여야 소리가 나는 경우가 있어, 하나를 계속 쓰는 쪽이 안전하다.
  useEffect(() => {
    audio.current = new Audio()
    return () => {
      audio.current?.pause()
      audio.current = null
    }
  }, [])

  const stop = useCallback(() => {
    if (audio.current) {
      audio.current.pause()
      audio.current.currentTime = 0
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
    setPlaying(null)
  }, [])

  useEffect(() => stop, [stop])

  const play = useCallback(
    (src: string, key: string, rate = 1) => {
      stop()
      const element = audio.current
      if (!element) return
      element.src = src
      element.playbackRate = rate
      element.onended = () => setPlaying(null)
      // 파일이 없거나 코덱을 못 읽을 때. 조용히 꺼 두고 흐름은 막지 않는다.
      element.onerror = () => setPlaying(null)
      setPlaying(key)
      // 구형 사파리의 play() 는 프라미스를 돌려주지 않는다. 바로 .catch 를 붙이면 그 자리에서 터진다.
      const started: unknown = element.play()
      if (started instanceof Promise) started.catch(() => setPlaying(null))
    },
    [stop],
  )

  const speak = useCallback(
    (text: string, key: string, rate = 1) => {
      if (typeof speechSynthesis === 'undefined') return
      stop()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = rate
      utterance.onend = () => setPlaying(null)
      utterance.onerror = () => setPlaying(null)
      setPlaying(key)
      speechSynthesis.speak(utterance)
    },
    [stop],
  )

  return { playing, play, stop, speak }
}
