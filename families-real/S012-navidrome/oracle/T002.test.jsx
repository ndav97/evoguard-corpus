import * as React from 'react'
import { TestContext } from 'ra-test'
import { DataProviderContext } from 'react-admin'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, afterEach, it, expect, vi } from 'vitest'
import { SaveQueueDialog } from '../dialogs/SaveQueueDialog'

const { notify } = vi.hoisted(() => ({ notify: vi.fn() }))
vi.mock('react-admin', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNotify: () => notify }
})

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

afterEach(() => {
  cleanup()
  notify.mockClear()
})

const failing = () => ({
  create: vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: { id: 'created-id' } }).mockResolvedValueOnce({ data: { id: 'pt-id' } }),
})

// T002 — Aviso dentro del diálogo cuando falla el guardado.
describe('T002 · aviso de error al guardar', () => {
  it('no hay aviso antes de intentar guardar', () => {
    renderDialog({ create: vi.fn() })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('si falla, muestra el aviso, conserva el nombre y deja reintentar', async () => {
    const user = userEvent.setup()
    const dataProvider = failing()
    renderDialog(dataProvider)
    await user.type(screen.getByRole('textbox'), 'Road trip')
    await user.click(saveButton())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not save the playlist.')
    expect(screen.getByRole('textbox')).toHaveValue('Road trip')
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await waitFor(() => expect(dataProvider.create).toHaveBeenCalledTimes(3))
  })

  it('el aviso desaparece al editar el nombre', async () => {
    const user = userEvent.setup()
    renderDialog(failing())
    await user.type(screen.getByRole('textbox'), 'Road trip')
    await user.click(saveButton())
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled())
    await user.type(screen.getByRole('textbox'), '!')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('el aviso desaparece al iniciar un nuevo guardado', async () => {
    const user = userEvent.setup()
    const dataProvider = {
      create: vi.fn().mockRejectedValueOnce(new Error('boom')).mockReturnValueOnce(new Promise(() => {})),
    }
    renderDialog(dataProvider)
    await user.type(screen.getByRole('textbox'), 'Road trip')
    await user.click(saveButton())
    await screen.findByRole('alert')
    await waitFor(() => expect(saveButton()).toBeEnabled())
    await user.click(saveButton())
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('el aviso desaparece al cerrar el diálogo', async () => {
    const user = userEvent.setup()
    renderDialog(failing())
    await user.type(screen.getByRole('textbox'), 'Road trip')
    await user.click(saveButton())
    await screen.findByRole('alert')
    const cancel = screen.getByRole('button', { name: /cancel/i })
    await waitFor(() => expect(cancel).toBeEnabled())
    await user.click(cancel)
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('se mantiene la notificación ra.page.error', async () => {
    const user = userEvent.setup()
    renderDialog(failing())
    await user.type(screen.getByRole('textbox'), 'Road trip')
    await user.click(saveButton())
    await screen.findByRole('alert')
    expect(notify.mock.calls.map(([message]) => message)).toContain('ra.page.error')
  })
})
