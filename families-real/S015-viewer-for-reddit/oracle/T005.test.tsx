// Tests ocultos del estudio.
import {SubscriptionFilterList} from '@/components/ui/SubscriptionFilterList/SubscriptionFilterList'
import {render, screen, userEvent} from '@/test-utils'
import {describe, expect, it} from 'vitest'

const subscriptions = [
  {name: 'reactjs', displayName: 'r/reactjs', subscribers: 500},
  {name: 'aww', displayName: 'r/aww', subscribers: 9000},
  {name: 'nextjs', displayName: 'r/nextjs', subscribers: 500},
  {name: 'webdev', displayName: 'r/webdev'}
]
const links = () => screen.queryAllByRole('link').map((link) => link.textContent)
const search = () => screen.getByLabelText('Search subscriptions')

const sortBy = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('combobox', {name: 'Sort subscriptions'}))
  await user.click(await screen.findByText(label))
}

// T005 — Escape vacía la búsqueda y el foco vuelve al campo.
describe('T005 · teclado en la búsqueda', () => {
  it('Escape con texto vacía el campo y mantiene el foco', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'react')
    expect(links()).toEqual(['r/reactjs'])
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
    expect(links()).toHaveLength(4)
  })

  it('Escape sin texto no hace nada', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.click(search())
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(links()).toHaveLength(4)
  })

  it('«Clear search» devuelve el foco al campo', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'golang')
    await user.click(screen.getByRole('button', {name: 'Clear search'}))
    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('Escape también quita el aviso sin resultados', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'golang')
    expect(screen.getByRole('status')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Clear search'})).not.toBeInTheDocument()
  })

  it('Escape no cambia el orden elegido', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await sortBy(user, 'A-Z')
    await user.type(search(), 'web')
    await user.keyboard('{Escape}')
    expect(links()).toEqual(['r/aww', 'r/nextjs', 'r/reactjs', 'r/webdev'])
  })
})
