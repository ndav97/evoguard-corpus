import * as React from 'react'
import { TestContext } from 'ra-test'
import { DataProviderContext } from 'react-admin'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, afterEach, it, expect, vi } from 'vitest'
import { SaveQueueDialog } from '../dialogs/SaveQueueDialog'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useHistory: () => ({ push: () => {} }) }
})

const songs = (n) => Array.from({ length: n }, (_, i) => ({ trackId: `song-${i + 1}` }))

const renderDialog = (dataProvider, queue = songs(2), current = undefined) =>
  render(
    <DataProviderContext.Provider value={dataProvider}>
      <TestContext
        initialState={{
          saveQueueDialog: { open: true },
          player: current ? { queue, current } : { queue },
          admin: { ui: { optimistic: false } },
        }}
      >
        <SaveQueueDialog />
      </TestContext>
    </DataProviderContext.Provider>,
  )

const ok = () =>
  vi
    .fn()
    .mockResolvedValueOnce({ data: { id: 'created-id' } })
    .mockResolvedValueOnce({ data: { id: 'pt-id' } })
const saveButton = () => screen.getByTestId('save-queue-save')
const count = () => screen.getByTestId('save-queue-count')

afterEach(cleanup)

const tracks = (...ids) => ids.map((trackId) => ({ trackId }))
const dedupe = () => screen.getByRole('checkbox', { name: 'Remove duplicate songs' })
const tracksSent = (dataProvider) => dataProvider.create.mock.calls[1]?.[1]

// T004 — Quitar canciones repetidas al guardar.
describe('T004 · quitar duplicados', () => {
  it('la casilla aparece desmarcada y por defecto se guardan todas', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider, tracks('a', 'b', 'a', 'c', 'b'))
    expect(dedupe()).not.toBeChecked()
    expect(count()).toHaveTextContent(/^5 songs will be saved$/)
    await user.type(screen.getByRole('textbox'), 'Mix')
    await user.click(saveButton())
    await waitFor(() => expect(dataProvider.create).toHaveBeenCalledTimes(2))
    expect(tracksSent(dataProvider).data.ids).toEqual(['a', 'b', 'a', 'c', 'b'])
  })

  it('marcada, guarda cada canción una vez en el orden de su primera aparición', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider, tracks('a', 'b', 'a', 'c', 'b'))
    await user.click(dedupe())
    expect(count()).toHaveTextContent(/^3 songs will be saved$/)
    await user.type(screen.getByRole('textbox'), 'Mix')
    await user.click(saveButton())
    await waitFor(() => expect(dataProvider.create).toHaveBeenCalledTimes(2))
    expect(tracksSent(dataProvider)).toEqual({ data: { ids: ['a', 'b', 'c'] }, filter: { playlist_id: 'created-id' } })
  })

  it('el recuento usa el singular si solo queda una canción', async () => {
    const user = userEvent.setup()
    renderDialog({ create: vi.fn() }, tracks('a', 'a', 'a'))
    await user.click(dedupe())
    expect(count()).toHaveTextContent(/^1 song will be saved$/)
  })

  it('desmarcarla vuelve a contar todas', async () => {
    const user = userEvent.setup()
    renderDialog({ create: vi.fn() }, tracks('a', 'a'))
    await user.click(dedupe())
    await user.click(dedupe())
    expect(count()).toHaveTextContent(/^2 songs will be saved$/)
  })

  it('con la cola vacía sigue avisando y sin guardar', () => {
    renderDialog({ create: vi.fn() }, [])
    expect(count()).toHaveTextContent(/^The queue is empty$/)
    expect(saveButton()).toBeDisabled()
  })
})
