import React, { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SearchInput } from '../dashboard/components/search-input'

type Props = React.ComponentProps<typeof SearchInput>

const setup = (props: Partial<Props> = {}) => {
  const searchRef = createRef<HTMLInputElement>()
  const onSearch = jest.fn()
  const view = render(
    <SearchInput searchRef={searchRef} onSearch={onSearch} {...props} />
  )
  const input = screen.getByTestId('search-input') as HTMLInputElement
  return { searchRef, onSearch, input, view }
}

const typeText = (input: HTMLInputElement, value: string) => {
  fireEvent.change(input, { target: { value } })
}

afterEach(() => {
  jest.useRealTimers()
})

// T002 — Número de resultados accesible.
describe('T002 · número de resultados', () => {
  const status = () => screen.queryByRole('status')

  it('sin texto no anuncia nada', () => {
    setup({ resultCount: 5 })
    expect(status()).not.toBeInTheDocument()
  })

  it('con texto anuncia el número en plural, singular o «No results»', () => {
    const { input, view, searchRef } = setup({ resultCount: 5 })
    typeText(input, 'blog')
    expect(status()).toHaveTextContent(/^5 results$/)

    view.rerender(
      <SearchInput searchRef={searchRef} onSearch={jest.fn()} resultCount={1} />
    )
    expect(status()).toHaveTextContent(/^1 result$/)

    view.rerender(
      <SearchInput searchRef={searchRef} onSearch={jest.fn()} resultCount={0} />
    )
    expect(status()).toHaveTextContent(/^No results$/)
  })

  it('sin resultCount no anuncia nada aunque haya texto', () => {
    const { input } = setup()
    typeText(input, 'blog')
    expect(status()).not.toBeInTheDocument()
  })

  it('al vaciar con «Clear search» deja de anunciar', () => {
    const { input } = setup({ resultCount: 3 })
    typeText(input, 'blog')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(status()).not.toBeInTheDocument()
  })
})
