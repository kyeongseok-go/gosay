// 묶음별 진도 계산. 화면에서 떼어 둬야 테스트가 쉽고, 빠른 새로고침도 깨지지 않는다.
import { dueOn } from '../../domain/review'
import type { Review, Sentence } from '../../domain/types'

export interface GroupRow {
  group: string
  total: number
  due: number
  /** 한 번이라도 '바로 나왔다' 를 받은 문장 수 */
  solid: number
}

/** 묶음별 진도. 외운 척이 아니라 '한 번이라도 바로 나왔다' 를 익힌 것으로 센다. */
export function groupRows(
  sentences: readonly Sentence[],
  reviews: Readonly<Record<string, Review>>,
  today: string,
): GroupRow[] {
  const rows = new Map<string, GroupRow>()
  for (const sentence of sentences) {
    const row = rows.get(sentence.group) ?? { group: sentence.group, total: 0, due: 0, solid: 0 }
    const review = reviews[sentence.id]
    rows.set(sentence.group, {
      ...row,
      total: row.total + 1,
      due: row.due + (dueOn(review, today) ? 1 : 0),
      solid: row.solid + (review && review.streak > 0 ? 1 : 0),
    })
  }
  return [...rows.values()].sort((a, b) => b.due - a.due || a.group.localeCompare(b.group))
}
