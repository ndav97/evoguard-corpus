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

// T002 — Estado vacío con opción de limpiar la búsqueda.
describe('T002 · sin resultados', () => {
  it('muestra el mensaje con la búsqueda recortada', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), ' golang ')
    expect(screen.getByRole('status')).toHaveTextContent('No subreddits match "golang"')
    expect(links()).toEqual([])
  })

  it('el botón Clear search vacía el campo y muestra todas', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    await user.type(search(), 'golang')
    await user.click(screen.getByRole('button', {name: 'Clear search'}))
    expect(search()).toHaveValue('')
    expect(links()).toHaveLength(4)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('no hay mensaje ni botón mientras haya resultados o sin búsqueda', async () => {
    const user = userEvent.setup()
    render(<SubscriptionFilterList subscriptions={subscriptions} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.type(search(), 'aww')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Clear search'})).not.toBeInTheDocument()
  })

  it('sin suscripciones y sin búsqueda no muestra el mensaje', () => {
    render(<SubscriptionFilterList subscriptions={[]} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
