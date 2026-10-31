import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Today } from './Today'
import { resetApp } from '../../test/reset'
import { useApp } from '../../store/app'
import { dayKeyOf } from '../../domain/date'

function show() {
  return render(
    <MemoryRouter>
      <Today />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await resetApp()
})

describe('Today', () => {
  test('읽는 동안에는 기다리는 글만 보인다', () => {
    useApp.setState({ ready: false })
    show()

    expect(screen.getByText('읽는 중이에요…')).toBeInTheDocument()
  })

  test('한 번 눌러 시작할 수 있고 카드 수가 보인다', async () => {
    show()

    const start = await screen.findByRole('button', { name: /오늘 연습 시작/ })
    expect(start).toBeEnabled()
    expect(start).toHaveTextContent('카드 8장')
  })

  test('처음에는 숫자가 0 이다', async () => {
    show()
    await screen.findByRole('button', { name: /오늘 연습 시작/ })

    expect(screen.getByText('오늘 말한 문장').nextSibling).toHaveTextContent('0')
    expect(screen.getByText('연속').nextSibling).toHaveTextContent('0일')
  })

  test('연습 중인 트랙과 문장 수를 알려 준다', async () => {
    show()
    await screen.findByRole('button', { name: /오늘 연습 시작/ })

    expect(screen.getByText(/회의와 코드 리뷰/)).toHaveTextContent(/문장 \d+장/)
  })

  test('시작을 누르면 세션이 만들어진다', async () => {
    show()
    const start = await screen.findByRole('button', { name: /오늘 연습 시작/ })

    await userEvent.click(start)

    await waitFor(() => {
      expect(Object.keys(useApp.getState().entities.sessions)).toHaveLength(1)
    })
  })

  test('중단한 세션이 있으면 이어서 하기로 바뀌고 멈춘 문장을 보여 준다', async () => {
    const session = useApp.getState().startSession()
    useApp.getState().grade('fluent')
    show()

    const resume = await screen.findByRole('button', { name: /이어서 하기/ })
    expect(resume).toHaveTextContent('2번째 카드부터')

    const id = session?.sentenceIds[1] ?? ''
    const ko = useApp.getState().entities.sentences[id].ko
    expect(screen.getByText(/중단한 자리를 그대로 두었어요/)).toHaveTextContent(ko.slice(0, 10))
  })

  test('채점한 문장이 오늘 숫자에 반영된다', async () => {
    useApp.getState().startSession()
    useApp.getState().grade('stuck')
    show()

    await screen.findByRole('button', { name: /이어서 하기/ })
    expect(screen.getByText('오늘 말한 문장').nextSibling).toHaveTextContent('1')
  })

  test('기다리는 문장이 없으면 시작 버튼이 잠긴다', async () => {
    const today = dayKeyOf(Date.now())
    const sentences = Object.values(useApp.getState().entities.sentences)
    useApp.getState().commit({
      puts: {
        reviews: sentences.map((row) => ({
          sentenceId: row.id,
          due: '2099-01-01',
          interval: 30,
          ease: 2,
          streak: 1,
          lastGrade: 'fluent' as const,
          stuckCount: 0,
          reviewedAt: today,
        })),
      },
      deletes: {},
    })

    show()

    const done = await screen.findByRole('button', { name: /오늘 몫을 끝냈어요/ })
    expect(done).toBeDisabled()
  })
})
