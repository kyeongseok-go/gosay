// 내 문장의 형태와 검사. 화면에서 떼어 둬야 테스트가 쉽다.
import type { Sentence, Track } from '../../domain/types'

/** 직접 넣은 문장의 묶음 이름. 번들 묶음과 섞이지 않게 한 칸으로 모은다. */
export const CUSTOM_GROUP = '내가 넣은 것'

export interface Draft {
  ko: string
  en: string
  note: string
  track: Track
}

/** 비어 있거나 공백뿐이면 만들지 않는다. 빈 카드가 세션에 섞이면 그 자리에서 흐름이 끊긴다. */
export function draftToSentence(draft: Draft, id: string): Sentence | null {
  const ko = draft.ko.trim()
  const en = draft.en.trim()
  if (ko === '' || en === '') return null
  return {
    id,
    track: draft.track,
    group: CUSTOM_GROUP,
    ko,
    en,
    note: draft.note.trim(),
    source: '직접 넣음',
    audio: null,
    custom: true,
  }
}
