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

// T003 — Escape vacía antes de salir del campo.
describe('T003 · Escape', () => {
  it('con texto, Escape vacía el campo y mantiene el foco', () => {
    const { input, onSearch } = setup()
    act(() => input.focus())
    typeText(input, 'abc')
    fireEvent.keyUp(input, { key: 'Escape' })
    expect(input.value).toBe('')
    expect(input).toHaveFocus()
    expect(onSearch).toHaveBeenLastCalledWith('')
  })

  it('con el campo vacío, Escape quita el foco', () => {
    const { input } = setup()
    act(() => input.focus())
    typeText(input, 'abc')
    fireEvent.keyUp(input, { key: 'Escape' })
    fireEvent.keyUp(input, { key: 'Escape' })
    expect(input).not.toHaveFocus()
  })

  it('tras vaciar con Escape desaparece el botón «Clear search»', () => {
    const { input } = setup()
    act(() => input.focus())
    typeText(input, 'abc')
    fireEvent.keyUp(input, { key: 'Escape' })
    expect(
      screen.queryByRole('button', { name: 'Clear search' })
    ).not.toBeInTheDocument()
  })
})
