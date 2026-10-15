// Tests ocultos del estudio.
import { screen } from '@testing-library/react'

import TraefikResourceStatsCard from 'components/resources/TraefikResourceStatsCard'
import { renderWithProviders } from 'utils/test'

const card = (errors: number, total: number, warnings: number) =>
  renderWithProviders(<TraefikResourceStatsCard title="Routers" errors={errors} total={total} warnings={warnings} linkTo="/http/routers" />)
const pc = (label: string) => screen.getByTestId(`${label}-pc`).textContent
const count = (label: string) => screen.getByTestId(`${label}-count`).textContent

const health = () => screen.getByRole('status')

// T005 — Línea de estado de la tarjeta.
describe('T005 · estado de los recursos', () => {
  it('sin avisos ni errores dice «All healthy»', () => {
    card(0, 4, 0)
    expect(health()).toHaveTextContent(/^All healthy$/)
  })

  it('cuenta los recursos con problemas (avisos + errores)', () => {
    card(2, 7, 4)
    expect(health()).toHaveTextContent(/^6 with problems$/)
  })

  it('usa el singular con un solo recurso con problemas', () => {
    card(0, 3, 1)
    expect(health()).toHaveTextContent(/^1 with a problem$/)
  })

  it('con datos incoherentes cuenta los avisos y errores mostrados', () => {
    card(1, 1, 2)
    expect(health()).toHaveTextContent(/^3 with problems$/)
    expect(count('success')).toBe('0')
  })

  it('la tarjeta vacía sigue sin mostrarse', () => {
    card(0, 0, 0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('la leyenda no cambia', () => {
    card(2, 7, 4)
    expect([pc('success'), pc('warnings'), pc('errors')]).toEqual(['14%', '57%', '29%'])
  })
})
