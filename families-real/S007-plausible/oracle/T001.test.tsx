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

const clearButton = () => screen.queryByRole('button', { name: 'Clear search' })

// T001 — Botón para vaciar la búsqueda.
describe('T001 · botón «Clear search»', () => {
  it('solo aparece cuando hay texto', () => {
    const { input } = setup()
    expect(clearButton()).not.toBeInTheDocument()
    typeText(input, 'abc')
    expect(clearButton()).toBeInTheDocument()
  })

  it('vacía el campo, busca "" sin esperar y devuelve el foco', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'abc')
    fireEvent.click(clearButton()!)
    expect(input.value).toBe('')
    expect(onSearch).toHaveBeenLastCalledWith('')
    expect(input).toHaveFocus()
    expect(clearButton()).not.toBeInTheDocument()
  })

  it('una búsqueda pendiente no reaparece después de vaciar', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'abc')
    fireEvent.click(clearButton()!)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch).toHaveBeenLastCalledWith('')
    expect(onSearch).not.toHaveBeenCalledWith('abc')
  })

  it('vuelven a mostrarse los textos de ayuda', () => {
    const { input } = setup()
    typeText(input, 'abc')
    expect(screen.queryByText('Press / to search')).not.toBeInTheDocument()
    fireEvent.click(clearButton()!)
    expect(screen.getByText('Press / to search')).toBeInTheDocument()
  })
})
