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

const counter = () => screen.queryByText(/^Showing \d+ of \d+ subreddits?$/)

// T004 — Recuento de resultados de la búsqueda.
describe('T004 · recuento de resultados', () => {
  it('sin búsqueda no se muestra el recuento', () => {
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    expect(counter()).not.toBeInTheDocument()
  })

  it('con búsqueda y resultados muestra cuántas coinciden del total', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'js')
    expect(screen.getByText('Showing 2 of 4 subreddits')).toBeInTheDocument()
    expect(links()).toEqual(['r/reactjs', 'r/nextjs'])
  })

  it('el recuento no es un elemento de estado', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'aww')
    expect(screen.getByText('Showing 1 of 4 subreddits')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('una búsqueda de solo espacios no muestra recuento', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), '   ')
    expect(counter()).not.toBeInTheDocument()
  })

  it('sin coincidencias se muestra el aviso y no el recuento', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'golang')
    expect(counter()).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('No subreddits match "golang"')
  })

  it('usa el singular si solo hay una suscripción', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={[{name: 'aww', displayName: 'r/aww'}]} />)
    await user.type(search(), 'a')
    expect(screen.getByText('Showing 1 of 1 subreddit')).toBeInTheDocument()
  })

  it('el orden no cambia el recuento', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'r/')
    await sortBy(user, 'Most subscribers')
    expect(screen.getByText('Showing 4 of 4 subreddits')).toBeInTheDocument()
  })
})
