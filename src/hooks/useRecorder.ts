// 내 발음 녹음. iOS 제약이 설계를 정한다:
//   - iOS Safari 는 `audio/webm` 을 지원하지 않는다 → mime 을 탐지해 `audio/mp4` 로 떨어뜨린다
//   - 마이크 권한을 거부해도 **흐름을 막지 않는다.** 녹음 없이 세 박자까지는 그대로 된다
import { useCallback, useEffect, useRef, useState } from 'react'

/** 좋은 것부터. 앞의 것이 되면 그걸 쓴다. */
export const CANDIDATE_MIMES: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
]

/**
 * 이 브라우저가 쓸 수 있는 녹음 형식. 없으면 null.
 * 순수 함수로 빼 둔 이유: iOS 에서 webm 이 빠지는 것이 이 앱의 가장 중요한 실기기 제약이라
 * 실제 기기 없이도 테스트로 고정해 두어야 한다.
 */
export function pickMime(isSupported: (mime: string) => boolean): string | null {
  return CANDIDATE_MIMES.find((mime) => isSupported(mime)) ?? null
}

export type RecorderPhase = 'idle' | 'recording' | 'denied' | 'unsupported'

export interface RecorderHandle {
  phase: RecorderPhase
  /** 방금 녹음한 것의 재생 주소. 없으면 null. */
  url: string | null
  blob: Blob | null
  mime: string | null
  start: () => Promise<void>
  stop: () => void
  /** 다음 카드로 갈 때 부른다. 주소를 풀어 주지 않으면 메모리가 샌다. */
  reset: () => void
}

function supported(mime: string): boolean {
  if (typeof MediaRecorder === 'undefined') return false
  return MediaRecorder.isTypeSupported(mime)
}

export function useRecorder(): RecorderHandle {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [mime, setMime] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const objectUrl = useRef<string | null>(null)

  const release = useCallback(() => {
    if (objectUrl.current !== null) {
      URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = null
    }
  }, [])

  useEffect(() => release, [release])

  const start = useCallback(async () => {
    const chosen = pickMime(supported)
    if (chosen === null || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setPhase('unsupported')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const instance = new MediaRecorder(stream, { mimeType: chosen })
      chunks.current = []
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data)
      }
      instance.onstop = () => {
        // 트랙을 놓지 않으면 아이폰 상태 표시줄에 녹음 중 표시가 남는다.
        for (const track of stream.getTracks()) track.stop()
        const recorded = new Blob(chunks.current, { type: chosen })
        release()
        objectUrl.current = URL.createObjectURL(recorded)
        setBlob(recorded)
        setUrl(objectUrl.current)
        setPhase('idle')
      }
      recorder.current = instance
      setMime(chosen)
      instance.start()
      setPhase('recording')
    } catch {
      // 권한 거부·마이크 없음·다른 앱이 점유. 어느 쪽이든 녹음만 못 하고 연습은 계속한다.
      setPhase('denied')
    }
  }, [release])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const reset = useCallback(() => {
    release()
    setUrl(null)
    setBlob(null)
    setPhase((before) => (before === 'recording' ? 'idle' : before))
  }, [release])

  return { phase, url, blob, mime, start, stop, reset }
}
