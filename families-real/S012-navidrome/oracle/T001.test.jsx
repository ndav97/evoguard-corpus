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

const renderDialog = (dataProvider, queue = songs(2)) =>
  render(
    <DataProviderContext.Provider value={dataProvider}>
      <TestContext
        initialState={{
          saveQueueDialog: { open: true },
          player: { queue },
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

// T001 — Nombre recortado y número de canciones que se guardarán.
describe('T001 · guardar la cola: nombre recortado y recuento', () => {
  it('envía el nombre sin espacios al inicio ni al final', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider)
    await user.type(screen.getByRole('textbox'), '  Road trip  ')
    await user.click(saveButton())
    await waitFor(() =>
      expect(dataProvider.create).toHaveBeenNthCalledWith(1, 'playlist', {
        data: { name: 'Road trip' },
      }),
    )
  })

  it('muestra cuántas canciones se guardarán (plural)', () => {
    renderDialog({ create: vi.fn() }, songs(3))
    expect(count()).toHaveTextContent(/^3 songs will be saved$/)
  })

  it('usa el singular con una sola canción', () => {
    renderDialog({ create: vi.fn() }, songs(1))
    expect(count()).toHaveTextContent(/^1 song will be saved$/)
  })

  it('sigue guardando la cola completa en la lista creada', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider)
    await user.type(screen.getByRole('textbox'), 'Mix')
    await user.click(saveButton())
    await waitFor(() =>
      expect(dataProvider.create).toHaveBeenNthCalledWith(2, 'playlistTrack', {
        data: { ids: ['song-1', 'song-2'] },
        filter: { playlist_id: 'created-id' },
      }),
    )
  })
})
