import { describe, expect, test } from 'vitest'
import { CUSTOM_GROUP, draftToSentence } from './draft'
import type { Draft } from './draft'

const draft: Draft = {
  ko: '제가 맡은 부분만 말씀드려도 될까요?',
  en: 'Can I just talk about the part I owned?',
  note: 'owned = 맡았다',
  track: 'interview',
}

describe('draftToSentence', () => {
  test('직접 넣은 문장으로 바뀐다', () => {
    const sentence = draftToSentence(draft, 'own-1')

    expect(sentence).toMatchObject({
      id: 'own-1',
      track: 'interview',
      group: CUSTOM_GROUP,
      ko: draft.ko,
      en: draft.en,
      custom: true,
    })
  })

  test('기준 음원이 없다 — 브라우저 음성으로 읽는다', () => {
    expect(draftToSentence(draft, 'own-1')?.audio).toBeNull()
  })

  test('출처가 남는다', () => {
    expect(draftToSentence(draft, 'own-1')?.source).toBe('직접 넣음')
  })

  test('앞뒤 공백을 떼어 낸다', () => {
    const padded = { ...draft, ko: '  안녕하세요  ', en: '  hello  ', note: '  메모  ' }

    const sentence = draftToSentence(padded, 'own-1')

    expect(sentence?.ko).toBe('안녕하세요')
    expect(sentence?.en).toBe('hello')
    expect(sentence?.note).toBe('메모')
  })

  test('한국어가 비면 만들지 않는다 — 빈 카드가 세션에 섞이면 흐름이 끊긴다', () => {
    expect(draftToSentence({ ...draft, ko: '   ' }, 'own-1')).toBeNull()
  })

  test('영어가 비면 만들지 않는다', () => {
    expect(draftToSentence({ ...draft, en: '' }, 'own-1')).toBeNull()
  })

  test('메모는 비어도 된다', () => {
    expect(draftToSentence({ ...draft, note: '' }, 'own-1')?.note).toBe('')
  })
})
