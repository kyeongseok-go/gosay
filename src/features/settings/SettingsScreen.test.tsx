import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SettingsScreen } from './SettingsScreen'
import { buildBackup } from './backup'
import { resetApp } from '../../test/reset'
import { useApp } from '../../store/app'
import { startingReview } from '../../domain/review'

function show() {
  return render(
    <MemoryRouter>
      <SettingsScreen />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  await resetApp()
})

describe('SettingsScreen', () => {
  test('읽는 동안에는 기다리는 글만 보인다', () => {
    useApp.setState({ ready: false })
    show()

    expect(screen.getByText('읽는 중이에요…')).toBeInTheDocument()
  })

  test('하루 분량을 바꾸면 설정에 남는다', async () => {
    show()

    const daily = screen.getByRole('group', { name: '하루 분량' })
    await userEvent.click(within(daily).getByRole('button', { name: '12장' }))

    expect(useApp.getState().settings.dailyCount).toBe(12)
  })

  test('기준 음원 속도를 바꿀 수 있다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: '0.75×' }))

    expect(useApp.getState().settings.speed).toBe(0.75)
  })

  test('화면 테마를 바꿀 수 있다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: '다크' }))

    expect(useApp.getState().settings.theme).toBe('dark')
  })

  test('문장이 없는 트랙은 고를 수 없다', () => {
    show()

    expect(screen.getByRole('button', { name: /업무 기술 영어/ })).toBeDisabled()
  })

  test('마지막 남은 트랙은 끄지 못한다 — 끄면 세션이 늘 0장이 된다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: /면접 영어/ }))

    expect(screen.getByRole('status')).toHaveTextContent('트랙은 하나 이상')
    expect(useApp.getState().settings.tracks).toEqual(['interview'])
  })

  test('백업을 가져오면 복습 기록이 들어온다', async () => {
    const id = Object.keys(useApp.getState().entities.sentences)[0]
    const backup = buildBackup({
      reviews: { [id]: { ...startingReview(id, '2026-10-29'), due: '2026-12-25', streak: 3 } },
      days: { '2026-10-29': { date: '2026-10-29', spoken: 7, stuck: 2 } },
      sentences: {},
      settings: { ...useApp.getState().settings, dailyCount: 20 },
      now: '2026-10-29T23:00:00.000Z',
    })
    const file = new File([JSON.stringify(backup)], 'gosay.json', { type: 'application/json' })

    const { container } = show()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(useApp.getState().entities.reviews[id].due).toBe('2026-12-25')
    })
    expect(useApp.getState().entities.days['2026-10-29'].spoken).toBe(7)
    expect(useApp.getState().settings.dailyCount).toBe(20)
  })

  test('gosay 백업이 아니면 거절하고 기록을 건드리지 않는다', async () => {
    const file = new File([JSON.stringify({ app: 'godo', tasks: [] })], 'godo.json', {
      type: 'application/json',
    })

    const { container } = show()
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('가져오지 못했어요')
    })
    expect(useApp.getState().entities.reviews).toEqual({})
  })

  test('전체 삭제는 한 번 더 묻고, 아니라고 하면 지우지 않는다', async () => {
    const id = Object.keys(useApp.getState().entities.sentences)[0]
    useApp.getState().commit({ puts: { reviews: [startingReview(id, '2026-10-29')] }, deletes: {} })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    show()
    await userEvent.click(screen.getByRole('button', { name: '학습 기록 지우기' }))

    expect(useApp.getState().entities.reviews[id]).toBeDefined()
    vi.restoreAllMocks()
  })

  test('전체 삭제를 승낙하면 복습 기록만 지우고 문장은 남긴다', async () => {
    const id = Object.keys(useApp.getState().entities.sentences)[0]
    useApp.getState().commit({ puts: { reviews: [startingReview(id, '2026-10-29')] }, deletes: {} })
    await useApp.getState().settled()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    show()
    await userEvent.click(screen.getByRole('button', { name: '학습 기록 지우기' }))

    await waitFor(() => {
      expect(useApp.getState().entities.reviews).toEqual({})
    })
    expect(Object.keys(useApp.getState().entities.sentences).length).toBeGreaterThan(0)
    vi.restoreAllMocks()
  })
})
