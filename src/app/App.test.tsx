import { beforeEach, describe, expect, test } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { resetApp } from '../test/reset'
import { useApp } from '../store/app'

beforeEach(async () => {
  document.documentElement.removeAttribute('data-theme')
  window.location.hash = '#/'
  await resetApp()
})

describe('App', () => {
  test('오늘 화면으로 시작하고 독이 보인다', async () => {
    render(<App />)

    expect(await screen.findByRole('button', { name: /오늘 연습 시작/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '화면 이동' })).toBeInTheDocument()
  })

  test('독으로 기록·설정·묶음으로 간다', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /오늘 연습 시작/ })

    await userEvent.click(screen.getByRole('link', { name: '기록' }))
    expect(await screen.findByRole('heading', { level: 1, name: '기록' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: '설정' }))
    expect(await screen.findByRole('heading', { level: 1, name: '설정' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: '묶음' }))
    expect(await screen.findByRole('heading', { level: 1, name: '묶음' })).toBeInTheDocument()
  })

  test('세션 화면에서는 독을 숨긴다 — 나가는 길은 접기 하나다', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /오늘 연습 시작/ }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '듣기' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('navigation', { name: '화면 이동' })).not.toBeInTheDocument()
  })

  test('테마를 고르면 문서에 반영되고, 기기 설정이면 속성을 지운다', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /오늘 연습 시작/ })

    useApp.getState().updateSettings({ theme: 'dark' })
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    })

    useApp.getState().updateSettings({ theme: 'auto' })
    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute('data-theme')
    })
  })

  test('읽기에 실패하면 화면 전체를 안내로 바꾼다 — 사생활 보호 창에서 실제로 난다', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /오늘 연습 시작/ })

    useApp.setState({ loadError: '저장된 데이터를 읽지 못했어요. (테스트)' })

    expect(await screen.findByRole('heading', { name: '데이터를 읽지 못했어요' })).toBeInTheDocument()
    expect(screen.getByText(/사생활 보호 창/)).toBeInTheDocument()
  })

  test('저장 실패는 알리고 닫을 수 있다', async () => {
    render(<App />)
    await screen.findByRole('button', { name: /오늘 연습 시작/ })

    useApp.setState({ persistError: '저장하지 못했어요. (테스트)' })
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했어요')

    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
