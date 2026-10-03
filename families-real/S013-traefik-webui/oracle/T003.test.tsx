// Tests ocultos del estudio.
import { screen } from '@testing-library/react'

import TraefikResourceStatsCard from 'components/resources/TraefikResourceStatsCard'
import { renderWithProviders } from 'utils/test'

const card = (errors: number, total: number, warnings: number) =>
  renderWithProviders(<TraefikResourceStatsCard title="Routers" errors={errors} total={total} warnings={warnings} linkTo="/http/routers" />)
const pc = (label: string) => screen.getByTestId(`${label}-pc`).textContent
const count = (label: string) => screen.getByTestId(`${label}-count`).textContent

// T003 — Datos incoherentes: errores + avisos mayor que el total.
describe('T003 · datos incoherentes', () => {
  it('el recuento de success nunca es negativo', () => {
    card(3, 4, 3)
    expect(count('success')).toBe('0')
    expect([count('warnings'), count('errors')]).toEqual(['3', '3'])
  })

  it('los porcentajes se calculan sobre la suma mostrada y suman 100', () => {
    card(3, 4, 3)
    expect([pc('success'), pc('warnings'), pc('errors')]).toEqual(['0%', '50%', '50%'])
  })

  it('las etiquetas accesibles usan la suma mostrada como total', () => {
    card(1, 1, 2)
    expect(screen.getByRole('link', { name: 'Warnings: 2 of 3 (67%)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Errors: 1 of 3 (33%)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Success: 0 of 3 (0%)' })).toBeInTheDocument()
  })

  it('con datos coherentes todo sigue igual', () => {
    card(1, 3, 1)
    expect([pc('success'), pc('warnings'), pc('errors')]).toEqual(['34%', '33%', '33%'])
    expect(screen.getByRole('link', { name: 'Warnings: 1 of 3 (33%)' })).toBeInTheDocument()
  })
})
