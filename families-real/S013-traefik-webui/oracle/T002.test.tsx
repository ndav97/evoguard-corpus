// Tests ocultos del estudio.
import { screen } from '@testing-library/react'

import TraefikResourceStatsCard from 'components/resources/TraefikResourceStatsCard'
import { renderWithProviders } from 'utils/test'

const card = (errors: number, total: number, warnings: number) =>
  renderWithProviders(<TraefikResourceStatsCard title="Routers" errors={errors} total={total} warnings={warnings} linkTo="/http/routers" />)
const pc = (label: string) => screen.getByTestId(`${label}-pc`).textContent
const count = (label: string) => screen.getByTestId(`${label}-count`).textContent

// T002 — Porcentajes que suman 100.
describe('T002 · porcentajes que suman 100', () => {
  it('reparte el punto que falta por redondeo (1/1/1 de 3)', () => {
    card(1, 3, 1)
    expect([pc('success'), pc('warnings'), pc('errors')]).toEqual(['34%', '33%', '33%'])
  })

  it('reparte dos puntos por mayor resto, con empate en el orden success, warnings, errors (4/1/1 de 6)', () => {
    card(1, 6, 1)
    expect([pc('success'), pc('warnings'), pc('errors')]).toEqual(['67%', '17%', '16%'])
  })

  it('da el punto al mayor resto aunque no sea el primero (1/4/2 de 7)', () => {
    card(2, 7, 4)
    expect([pc('success'), pc('warnings'), pc('errors')]).toEqual(['14%', '57%', '29%'])
  })

  it('las etiquetas accesibles usan los mismos porcentajes', () => {
    card(1, 3, 1)
    expect(screen.getByRole('link', { name: 'Success: 1 of 3 (34%)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Errors: 1 of 3 (33%)' })).toBeInTheDocument()
  })

  it('los recuentos no cambian', () => {
    card(1, 6, 1)
    expect([count('success'), count('warnings'), count('errors')]).toEqual(['4', '1', '1'])
  })
})
