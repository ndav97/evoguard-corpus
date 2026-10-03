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

// T003 — Cola vacía: no se puede guardar.
describe('T003 · cola vacía', () => {
  it('muestra que la cola está vacía en lugar del recuento', () => {
    renderDialog({ create: vi.fn() }, [])
    expect(count()).toHaveTextContent(/^The queue is empty$/)
  })

  it('el botón Guardar sigue deshabilitado aunque haya nombre', async () => {
    const user = userEvent.setup()
    renderDialog({ create: vi.fn() }, [])
    await user.type(screen.getByRole('textbox'), 'Empty list')
    expect(saveButton()).toBeDisabled()
  })

  it('Enter no crea ninguna lista', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: vi.fn() }
    renderDialog(dataProvider, [])
    await user.type(screen.getByRole('textbox'), 'Empty list{Enter}')
    expect(dataProvider.create).not.toHaveBeenCalled()
  })

  it('con canciones en la cola, Enter sigue guardando', async () => {
    const user = userEvent.setup()
    const dataProvider = { create: ok() }
    renderDialog(dataProvider, songs(1))
    await user.type(screen.getByRole('textbox'), 'One{Enter}')
    await waitFor(() =>
      expect(dataProvider.create).toHaveBeenNthCalledWith(1, 'playlist', { data: { name: 'One' } }),
    )
  })
})
