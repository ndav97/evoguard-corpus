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

// T001 — Búsqueda que ignora espacios y admite el prefijo r/.
describe('T001 · búsqueda de suscripciones', () => {
  it('ignora los espacios al inicio y al final', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), '  aww  ')
    expect(links()).toEqual(['r/aww'])
  })

  it('admite el nombre con el prefijo r/', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'r/next')
    expect(links()).toEqual(['r/nextjs'])
  })

  it('sigue sin distinguir mayúsculas y buscando por subcadena', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'JS')
    expect(links()).toEqual(['r/reactjs', 'r/nextjs'])
  })

  it('una búsqueda solo con espacios muestra todo', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), '   ')
    expect(links()).toHaveLength(4)
  })
})
