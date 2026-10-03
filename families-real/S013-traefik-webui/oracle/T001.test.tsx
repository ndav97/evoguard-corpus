// Tests ocultos del estudio.
import { screen } from '@testing-library/react'

import TraefikResourceStatsCard from 'components/resources/TraefikResourceStatsCard'
import { renderWithProviders } from 'utils/test'

const card = (errors: number, total: number, warnings: number) =>
  renderWithProviders(<TraefikResourceStatsCard title="Routers" errors={errors} total={total} warnings={warnings} linkTo="/http/routers" />)
const pc = (label: string) => screen.getByTestId(`${label}-pc`).textContent
const count = (label: string) => screen.getByTestId(`${label}-count`).textContent

// T001 — Nombre accesible de cada entrada de la leyenda.
describe('T001 · leyenda accesible', () => {
  it('cada entrada describe estado, recuento, total y porcentaje', () => {
    card(2, 7, 4)
    expect(screen.getByRole('link', { name: 'Success: 1 of 7 (14%)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Warnings: 4 of 7 (57%)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Errors: 2 of 7 (29%)' })).toBeInTheDocument()
  })

  it('cada entrada sigue enlazando al listado filtrado por su estado', () => {
    card(2, 7, 4)
    expect(screen.getByRole('link', { name: 'Success: 1 of 7 (14%)' })).toHaveAttribute('href', '/http/routers?status=enabled')
    expect(screen.getByRole('link', { name: 'Warnings: 4 of 7 (57%)' })).toHaveAttribute('href', '/http/routers?status=warning')
    expect(screen.getByRole('link', { name: 'Errors: 2 of 7 (29%)' })).toHaveAttribute('href', '/http/routers?status=disabled')
  })

  it('el enlace Explore no cambia', () => {
    card(2, 7, 4)
    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', '/http/routers')
  })
})
