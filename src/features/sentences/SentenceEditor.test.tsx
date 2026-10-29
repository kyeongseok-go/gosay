import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SentenceEditor } from './SentenceEditor'
import { CUSTOM_GROUP } from './draft'
import { resetApp } from '../../test/reset'
import { useApp } from '../../store/app'
import { startingReview } from '../../domain/review'

function show() {
  return render(
    <MemoryRouter>
      <SentenceEditor />
    </MemoryRouter>,
  )
}

async function fill(ko: string, en: string) {
  await userEvent.type(screen.getByLabelText('한국어'), ko)
  await userEvent.type(screen.getByLabelText('영어'), en)
}

beforeEach(async () => {
  await resetApp()
})

describe('SentenceEditor', () => {
  test('읽는 동안에는 기다리는 글만 보인다', () => {
    useApp.setState({ ready: false })
    show()

    expect(screen.getByText('읽는 중이에요…')).toBeInTheDocument()
  })

  test('처음에는 넣은 문장이 없다', () => {
    show()

    expect(screen.getByText(/아직 없어요/)).toBeInTheDocument()
  })

  test('문장을 넣으면 목록에 나오고 저장된다', async () => {
    show()

    await fill('제가 맡은 부분만 말씀드려도 될까요?', 'Can I just talk about the part I owned?')
    await userEvent.click(screen.getByRole('button', { name: '문장 넣기' }))

    expect(await screen.findByText('Can I just talk about the part I owned?')).toBeInTheDocument()
    const added = Object.values(useApp.getState().entities.sentences).filter((row) => row.custom)
    expect(added).toHaveLength(1)
    expect(added[0].group).toBe(CUSTOM_GROUP)
  })

  test('넣고 나면 입력칸이 비워진다', async () => {
    show()

    await fill('안녕하세요', 'hello')
    await userEvent.click(screen.getByRole('button', { name: '문장 넣기' }))

    await waitFor(() => {
      expect(screen.getByLabelText('한국어')).toHaveValue('')
    })
  })

  test('한쪽만 적으면 넣지 않고 이유를 말한다', async () => {
    show()

    await userEvent.type(screen.getByLabelText('한국어'), '영어는 안 적었다')
    await userEvent.click(screen.getByRole('button', { name: '문장 넣기' }))

    expect(screen.getByRole('alert')).toHaveTextContent('둘 다 적어')
    expect(Object.values(useApp.getState().entities.sentences).filter((row) => row.custom)).toHaveLength(0)
  })

  test('트랙을 고를 수 있다', async () => {
    show()

    await userEvent.click(screen.getByRole('button', { name: '짧은 것' }))
    await fill('안녕하세요', 'hello')
    await userEvent.click(screen.getByRole('button', { name: '문장 넣기' }))

    await waitFor(() => {
      const added = Object.values(useApp.getState().entities.sentences).find((row) => row.custom)
      expect(added?.track).toBe('small')
    })
  })

  test('지우면 복습 기록도 함께 지워진다 — 문장 없는 기록은 빈 카드를 만든다', async () => {
    show()
    await fill('안녕하세요', 'hello')
    await userEvent.click(screen.getByRole('button', { name: '문장 넣기' }))

    const added = await waitFor(() => {
      const row = Object.values(useApp.getState().entities.sentences).find((each) => each.custom)
      expect(row).toBeDefined()
      return row!
    })
    useApp.getState().commit({ puts: { reviews: [startingReview(added.id, '2026-10-29')] }, deletes: {} })

    await userEvent.click(screen.getByRole('button', { name: `${added.ko} 지우기` }))

    await waitFor(() => {
      expect(useApp.getState().entities.sentences[added.id]).toBeUndefined()
    })
    expect(useApp.getState().entities.reviews[added.id]).toBeUndefined()
  })

  test('넣은 문장은 읽어 주기 버튼이 붙는다 — 기준 음원이 없기 때문이다', async () => {
    show()
    await fill('안녕하세요', 'hello')
    await userEvent.click(screen.getByRole('button', { name: '문장 넣기' }))

    expect(await screen.findByRole('button', { name: '안녕하세요 읽어 주기' })).toBeInTheDocument()
    const added = Object.values(useApp.getState().entities.sentences).find((row) => row.custom)
    expect(added?.audio).toBeNull()
  })
})
