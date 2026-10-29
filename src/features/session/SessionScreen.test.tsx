import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionScreen } from './SessionScreen'
import { audioUrl } from './audioUrl'
import { resetApp } from '../../test/reset'
import { useApp } from '../../store/app'

function show() {
  return render(
    <MemoryRouter>
      <SessionScreen />
    </MemoryRouter>,
  )
}

/** 한 박자 앞으로. 박자마다 버튼 글이 다르다. */
async function step(label: string) {
  await userEvent.click(screen.getByRole('button', { name: label }))
}

beforeEach(async () => {
  await resetApp()
})

describe('SessionScreen', () => {
  test('읽는 동안에는 기다리는 글만 보인다', () => {
    useApp.setState({ ready: false })
    show()

    expect(screen.getByText('읽는 중이에요…')).toBeInTheDocument()
  })

  test('세션이 없으면 끝난 화면을 보여 준다', async () => {
    show()

    expect(await screen.findByText('오늘 몫을 끝냈어요')).toBeInTheDocument()
  })

  test('첫 박자는 듣기이고 한국어와 영어가 함께 보인다', async () => {
    const session = useApp.getState().startSession()
    show()

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('듣기')
    const first = useApp.getState().entities.sentences[session?.sentenceIds[0] ?? '']
    expect(screen.getByText(first.ko)).toBeInTheDocument()
    expect(screen.getByText(first.en)).toBeInTheDocument()
  })

  test('3박자에서는 영어가 가려진다 — 이 앱의 존재 이유다', async () => {
    const session = useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })

    await step('들었다, 다음')
    await step('따라 말했다, 다음')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('가린 채 말하기')
    const first = useApp.getState().entities.sentences[session?.sentenceIds[0] ?? '']
    expect(screen.queryByText(first.en)).not.toBeInTheDocument()
    expect(screen.getByText(first.ko)).toBeInTheDocument()
  })

  test('열기를 누르면 가린 영어가 보인다', async () => {
    const session = useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })
    await step('들었다, 다음')
    await step('따라 말했다, 다음')

    await step('도저히 안 나오면 열기')

    const first = useApp.getState().entities.sentences[session?.sentenceIds[0] ?? '']
    expect(screen.getByText(first.en)).toBeInTheDocument()
  })

  test('4박자에서 핵심 표현 메모와 A/B 대조가 나온다', async () => {
    useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })
    await step('들었다, 다음')
    await step('따라 말했다, 다음')
    await step('말했다, 들어 보기')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('대조와 채점')
    expect(screen.getByRole('button', { name: '기준 음원' })).toBeEnabled()
    // 녹음이 없으면 내 녹음은 누를 수 없다. 그래도 채점은 된다.
    expect(screen.getByRole('button', { name: '내 녹음' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /막혔다/ })).toBeEnabled()
  })

  test('채점하면 다음 카드의 첫 박자로 간다', async () => {
    const session = useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })
    await step('들었다, 다음')
    await step('따라 말했다, 다음')
    await step('말했다, 들어 보기')

    await userEvent.click(screen.getByRole('button', { name: /바로 나왔다/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('듣기')
    })
    const second = useApp.getState().entities.sentences[session?.sentenceIds[1] ?? '']
    expect(screen.getByText(second.ko)).toBeInTheDocument()
    expect(screen.getByText('2 / 8')).toBeInTheDocument()
  })

  test('막혔다를 고르면 복습이 오늘로 초기화된다', async () => {
    const session = useApp.getState().startSession()
    const id = session?.sentenceIds[0] ?? ''
    show()
    await screen.findByRole('heading', { level: 1 })
    await step('들었다, 다음')
    await step('따라 말했다, 다음')
    await step('말했다, 들어 보기')

    await userEvent.click(screen.getByRole('button', { name: /막혔다/ }))

    await waitFor(() => {
      expect(useApp.getState().entities.reviews[id].interval).toBe(0)
    })
    expect(useApp.getState().entities.reviews[id].stuckCount).toBe(1)
  })

  test('재생 속도를 바꾸면 설정에 남는다', async () => {
    useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })

    await userEvent.click(screen.getByRole('button', { name: '0.75×' }))

    expect(useApp.getState().settings.speed).toBe(0.75)
    expect(screen.getByRole('button', { name: '0.75×' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('기준 음원 버튼이 번들된 파일을 가리킨다', async () => {
    const session = useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })

    await userEvent.click(screen.getByRole('button', { name: '기준 음원 재생' }))

    const first = useApp.getState().entities.sentences[session?.sentenceIds[0] ?? '']
    expect(first.audio).not.toBeNull()
    expect(audioUrl(first.audio ?? '')).toContain('.m4a')
  })

  test('녹음을 지원하지 않는 환경이면 그렇다고 알려 준다', async () => {
    useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })
    await step('들었다, 다음')
    await step('따라 말했다, 다음')

    await userEvent.click(screen.getByRole('button', { name: '녹음 시작' }))

    // jsdom 에는 MediaRecorder 가 없다 — iOS 에서 녹음이 막히는 경우와 같은 길이다.
    await waitFor(() => {
      expect(screen.getByText(/녹음을 지원하지 않아요|마이크를 쓸 수 없어요/)).toBeInTheDocument()
    })
    // 그래도 다음 박자로 넘어간다. 녹음이 흐름을 막지 않는다.
    await step('말했다, 들어 보기')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('대조와 채점')
  })

  test('접기를 누르면 세션이 닫힌다', async () => {
    useApp.getState().startSession()
    show()
    await screen.findByRole('heading', { level: 1 })

    await userEvent.click(screen.getByRole('button', { name: '접기' }))

    await waitFor(() => {
      const session = Object.values(useApp.getState().entities.sessions)[0]
      expect(session.finishedAt).not.toBeNull()
    })
  })

  test('박자 눈금이 지나온 박자만큼 채워진다', async () => {
    useApp.getState().startSession()
    const { container } = show()
    await screen.findByRole('heading', { level: 1 })

    expect(container.querySelectorAll('.beatbar__seg--on')).toHaveLength(1)
    await step('들었다, 다음')
    expect(container.querySelectorAll('.beatbar__seg--on')).toHaveLength(2)
  })
})
