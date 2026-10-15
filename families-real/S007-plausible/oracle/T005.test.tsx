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

// T005 — Longitud mínima de la búsqueda.
describe('T005 · longitud mínima', () => {
  it('por debajo del mínimo muestra el aviso y busca ""', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup({ minLength: 3 })
    typeText(input, 'ab')
    expect(screen.getByText('Type at least 3 characters')).toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch.mock.calls).toEqual([['']])
  })

  it('al llegar al mínimo desaparece el aviso y se busca el texto', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup({ minLength: 3 })
    typeText(input, 'ab')
    typeText(input, 'abc')
    expect(screen.queryByText(/^Type at least/)).not.toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch).toHaveBeenLastCalledWith('abc')
  })

  it('los espacios no cuentan para el mínimo', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup({ minLength: 3 })
    typeText(input, ' ab ')
    expect(screen.getByText('Type at least 3 characters')).toBeInTheDocument()
    pressEnterAndFlush(input)
    expect(onSearch).not.toHaveBeenCalledWith(' ab ')
    expect(onSearch).toHaveBeenLastCalledWith('')
  })

  it('mientras se muestra el aviso no se anuncian resultados', () => {
    const { input } = setup({ minLength: 2, resultCount: 4 })
    typeText(input, 'a')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    typeText(input, 'ab')
    expect(screen.getByRole('status')).toHaveTextContent('4 results')
  })

  it('Enter respeta el mínimo', () => {
    const { input, onSearch } = setup({ minLength: 4 })
    typeText(input, 'abc')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSearch.mock.calls).toEqual([['']])
  })

  it('sin minLength todo funciona como antes y no hay aviso', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'a')
    expect(screen.queryByText(/^Type at least/)).not.toBeInTheDocument()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch).toHaveBeenLastCalledWith('a')
  })

  it('«Clear search» quita el aviso', () => {
    const { input } = setup({ minLength: 3 })
    typeText(input, 'a')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.queryByText(/^Type at least/)).not.toBeInTheDocument()
  })
})

function pressEnterAndFlush(input: HTMLInputElement) {
  fireEvent.keyDown(input, { key: 'Enter' })
  act(() => {
    jest.advanceTimersByTime(1000)
  })
}
