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

const pressEnter = (input: HTMLInputElement) => {
  fireEvent.keyDown(input, { key: 'Enter' })
}

// T004 — Enter busca sin esperar y no se repiten búsquedas iguales.
describe('T004 · Enter y búsquedas repetidas', () => {
  it('Enter busca el texto actual sin esperar al retardo', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'blog')
    expect(onSearch).not.toHaveBeenCalled()
    pressEnter(input)
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenLastCalledWith('blog')
  })

  it('tras Enter, el retardo no vuelve a enviar el mismo texto', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'blog')
    pressEnter(input)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch).toHaveBeenCalledTimes(1)
  })

  it('un texto distinto después de Enter sí se envía con el retardo', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'blog')
    pressEnter(input)
    typeText(input, 'blogs')
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch.mock.calls).toEqual([['blog'], ['blogs']])
  })

  it('volver al mismo texto antes de que pase el retardo no repite la búsqueda', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'abc')
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    typeText(input, 'abcd')
    typeText(input, 'abc')
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch.mock.calls).toEqual([['abc']])
  })

  it('Enter pulsado dos veces solo busca una vez', () => {
    const { input, onSearch } = setup()
    typeText(input, 'x')
    pressEnter(input)
    pressEnter(input)
    expect(onSearch.mock.calls).toEqual([['x']])
  })

  it('vaciar sigue enviando "" aunque no se hubiera enviado nada antes', () => {
    jest.useFakeTimers()
    const { input, onSearch } = setup()
    typeText(input, 'abc')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onSearch.mock.calls).toEqual([['']])
  })
})
