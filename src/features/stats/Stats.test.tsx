import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Stats } from './Stats'
import { resetApp } from '../../test/reset'
import { useApp } from '../../store/app'
import { addDays, dayKeyOf } from '../../domain/date'
import { nextReview, startingReview } from '../../domain/review'

function show() {
  return render(
    <MemoryRouter>
      <Stats />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await resetApp()
})

describe('Stats', () => {
  test('읽는 동안에는 기다리는 글만 보인다', () => {
    useApp.setState({ ready: false })
    show()

    expect(screen.getByText('읽는 중이에요…')).toBeInTheDocument()
  })

  test('아직 막힌 문장이 없으면 그렇다고 말한다', () => {
    show()

    expect(screen.getByText(/아직 막힌 문장이 없어요/)).toBeInTheDocument()
  })

  test('누적과 연속일을 보여 준다', () => {
    const today = dayKeyOf(Date.now())
    useApp.getState().commit({
      puts: {
        days: [
          { date: today, spoken: 4, stuck: 1 },
          { date: addDays(today, -1), spoken: 6, stuck: 0 },
        ],
      },
      deletes: {},
    })

    show()

    expect(screen.getByText('누적 말한 문장').nextSibling).toHaveTextContent('10')
    expect(screen.getByText('연속').nextSibling).toHaveTextContent('2일')
  })

  test('막힌 문장을 많이 막힌 순서로 보여 준다', () => {
    const today = dayKeyOf(Date.now())
    const ids = Object.keys(useApp.getState().entities.sentences).slice(0, 2)
    const once = nextReview(startingReview(ids[0], today), 'stuck', today)
    const twice = nextReview(nextReview(startingReview(ids[1], today), 'stuck', today), 'stuck', today)

    useApp.getState().commit({ puts: { reviews: [once, twice] }, deletes: {} })
    show()

    const counts = screen.getAllByTitle('막힌 횟수').map((node) => node.textContent)
    expect(counts).toEqual(['2번', '1번'])
    expect(screen.getByText('막힌 적 있는 문장').nextSibling).toHaveTextContent('2')
  })

  test('최근 2주 막대가 14칸이다', () => {
    const { container } = show()

    expect(container.querySelectorAll('.chart__col')).toHaveLength(14)
  })

  test('말한 날의 막대만 강조된다', () => {
    const today = dayKeyOf(Date.now())
    useApp.getState().commit({ puts: { days: [{ date: today, spoken: 3, stuck: 0 }] }, deletes: {} })

    const { container } = show()

    expect(container.querySelectorAll('.chart__bar--on')).toHaveLength(1)
  })
})
