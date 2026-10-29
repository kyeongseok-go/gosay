import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Tracks } from './Tracks'
import { resetApp } from '../../test/reset'
import { useApp } from '../../store/app'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function show() {
  return render(
    <MemoryRouter>
      <Tracks />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  navigate.mockClear()
  await resetApp()
})

describe('Tracks', () => {
  test('읽는 동안에는 기다리는 글만 보인다', () => {
    useApp.setState({ ready: false })
    show()

    expect(screen.getByText('읽는 중이에요…')).toBeInTheDocument()
  })

  test('문장이 있는 트랙만 보여 준다', () => {
    const empty = Object.values(useApp.getState().entities.sentences)
      .filter((row) => row.track === 'small')
      .map((row) => row.id)
    useApp.getState().commit({ puts: {}, deletes: { sentences: empty } })

    show()

    expect(screen.getByRole('heading', { name: /면접 영어/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /업무 기술 영어/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /짧은 것/ })).not.toBeInTheDocument()
  })

  test('묶음과 장수를 보여 준다', () => {
    show()

    const group = screen.getByRole('button', { name: /못 들었을 때/ })
    expect(group).toHaveTextContent('0 / 15')
    expect(group).toHaveTextContent('15 대기')
  })

  test('묶음을 누르면 그 묶음만으로 세션이 만들어진다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: /못 들었을 때/ }))

    await waitFor(() => {
      const session = Object.values(useApp.getState().entities.sessions).find((row) => row.finishedAt === null)
      expect(session).toBeDefined()
      const groups = session?.sentenceIds.map((id) => useApp.getState().entities.sentences[id].group)
      expect(new Set(groups)).toEqual(new Set(['못 들었을 때']))
    })
    expect(navigate).toHaveBeenCalledWith('/session')
  })

  test('묶음 연습은 하루 분량을 넘지 않는다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: /못 들었을 때/ }))

    await waitFor(() => {
      const session = Object.values(useApp.getState().entities.sessions).find((row) => row.finishedAt === null)
      expect(session?.sentenceIds).toHaveLength(useApp.getState().settings.dailyCount)
    })
  })

  test('다른 묶음을 고르면 앞 세션은 닫힌다 — 열린 세션은 늘 하나다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: /못 들었을 때/ }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: /자기소개/ }))

    await waitFor(() => {
      const open = Object.values(useApp.getState().entities.sessions).filter((row) => row.finishedAt === null)
      expect(open).toHaveLength(1)
    })
  })
})
