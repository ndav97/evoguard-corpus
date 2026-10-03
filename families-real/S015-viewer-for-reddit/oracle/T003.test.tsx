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
  await user.click(await screen.findByRole('option', {name: label}))
}

// T003 — Orden por número de suscriptores.
describe('T003 · ordenar por suscriptores', () => {
  it('ofrece la opción Most subscribers', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.click(screen.getByRole('combobox', {name: 'Sort subscriptions'}))
    expect(await screen.findByRole('option', {name: 'Most subscribers'})).toBeInTheDocument()
  })

  it('ordena de más a menos, empates A-Z y sin dato al final', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await sortBy(user, 'Most subscribers')
    expect(links()).toEqual(['r/aww', 'r/nextjs', 'r/reactjs', 'r/webdev'])
  })

  it('combina el orden con la búsqueda', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await sortBy(user, 'Most subscribers')
    await user.type(search(), 'r/')
    expect(links()).toEqual(['r/aww', 'r/nextjs', 'r/reactjs', 'r/webdev'])
    await user.clear(search())
    await user.type(search(), 'js')
    expect(links()).toEqual(['r/nextjs', 'r/reactjs'])
  })

  it('los demás órdenes no cambian', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await sortBy(user, 'Z-A')
    expect(links()).toEqual(['r/webdev', 'r/reactjs', 'r/nextjs', 'r/aww'])
  })
})
