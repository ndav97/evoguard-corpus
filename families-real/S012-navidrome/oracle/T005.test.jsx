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

const q = (...ids) => ids.map((trackId) => ({ trackId, uuid: `u-${trackId}` }))
const fromCurrent = () => screen.queryByRole('checkbox', { name: 'Start from the current song' })
const tracksSent = (dataProvider) => dataProvider.create.mock.calls[1]?.[1]

// T005 — Guardar desde la canción actual.
describe('T005 · desde la canción actual', () => {
  it('sin canción actual en la cola no se ofrece la opción', () => {
    renderDialog({ create: vi.fn() }, q('a', 'b'))
    expect(fromCurrent()).not.toBeInTheDocument()
    renderDialog({ create: vi.fn() }, q('a', 'b'), { uuid: 'other' })
    expect(fromCurrent()).not.toBeInTheDocument()
  })

  it('con canción actual se ofrece desmarcada y no cambia nada', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider, q('a', 'b', 'c', 'd'), { uuid: 'u-c' })
    expect(fromCurrent()).not.toBeChecked()
    expect(count()).toHaveTextContent(/^4 songs will be saved$/)
    await user.type(screen.getByRole('textbox'), 'All')
    await user.click(saveButton())
    await waitFor(() => expect(dataProvider.create).toHaveBeenCalledTimes(2))
    expect(tracksSent(dataProvider).data.ids).toEqual(['a', 'b', 'c', 'd'])
  })

  it('marcada, guarda desde la canción actual (incluida) hasta el final', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider, q('a', 'b', 'c', 'd'), { uuid: 'u-c' })
    await user.click(fromCurrent())
    expect(count()).toHaveTextContent(/^2 songs will be saved$/)
    await user.type(screen.getByRole('textbox'), 'Rest')
    await user.click(saveButton())
    await waitFor(() => expect(dataProvider.create).toHaveBeenCalledTimes(2))
    expect(tracksSent(dataProvider).data.ids).toEqual(['c', 'd'])
  })

  it('se combina con quitar duplicados', async () => {
    const user = userEvent.setup()
    const queue = [...q('a', 'b'), { trackId: 'c', uuid: 'u-c1' }, { trackId: 'a', uuid: 'u-a2' }, { trackId: 'c', uuid: 'u-c2' }]
    const dataProvider = { create: ok() }
    renderDialog(dataProvider, queue, { uuid: 'u-c1' })
    await user.click(fromCurrent())
    await user.click(screen.getByRole('checkbox', { name: 'Remove duplicate songs' }))
    expect(count()).toHaveTextContent(/^2 songs will be saved$/)
    await user.type(screen.getByRole('textbox'), 'Tail{Enter}')
    await waitFor(() => expect(dataProvider.create).toHaveBeenCalledTimes(2))
    expect(tracksSent(dataProvider).data.ids).toEqual(['c', 'a'])
  })

  it('con la canción actual al final, el recuento usa el singular', async () => {
    const user = userEvent.setup()
    renderDialog({ create: vi.fn() }, q('a', 'b', 'c'), { uuid: 'u-c' })
    await user.click(fromCurrent())
    expect(count()).toHaveTextContent(/^1 song will be saved$/)
  })
})
