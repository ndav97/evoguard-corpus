// Tests ocultos del estudio.
import { screen } from '@testing-library/react'

import TraefikResourceStatsCard from 'components/resources/TraefikResourceStatsCard'
import { renderWithProviders } from 'utils/test'

const card = (errors: number, total: number, warnings: number, hideEmpty?: boolean) =>
  renderWithProviders(
    <TraefikResourceStatsCard
      title="Routers"
      errors={errors}
      total={total}
      warnings={warnings}
      linkTo="/http/routers"
      {...(hideEmpty === undefined ? {} : { hideEmpty })}
    />,
  )
const legendLinks = () => screen.getAllByRole('link').filter((link) => /\?status=/.test(link.getAttribute('href') ?? ''))
const pc = (label: string) => screen.getByTestId(`${label}-pc`).textContent
const count = (label: string) => screen.getByTestId(`${label}-count`).textContent

// T004 — Ocultar las entradas vacías de la leyenda.
describe('T004 · hideEmpty', () => {
  it('sin la prop se muestran las tres entradas aunque alguna valga 0', () => {
    card(0, 5, 2)
    expect(legendLinks()).toHaveLength(3)
    expect(count('errors')).toBe('0')
  })

  it('con hideEmpty se ocultan las entradas con recuento 0', () => {
    card(0, 5, 2, true)
    expect(legendLinks().map((l) => l.getAttribute('href'))).toEqual(['/http/routers?status=enabled', '/http/routers?status=warning'])
    expect(screen.queryByTestId('errors-count')).not.toBeInTheDocument()
    expect(screen.queryByTestId('errors-pc')).not.toBeInTheDocument()
  })

  it('las entradas visibles conservan sus valores y nombres accesibles', () => {
    card(0, 5, 2, true)
    expect([pc('success'), pc('warnings')]).toEqual(['60%', '40%'])
    expect(screen.getByRole('link', { name: 'Success: 3 of 5 (60%)' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Warnings: 2 of 5 (40%)' })).toBeInTheDocument()
  })

  it('también oculta Success cuando los datos son incoherentes', () => {
    card(3, 4, 3, true)
    expect(screen.queryByTestId('success-count')).not.toBeInTheDocument()
    expect([pc('warnings'), pc('errors')]).toEqual(['50%', '50%'])
  })

  it('con hideEmpty={false} se comporta como sin la prop', () => {
    card(0, 4, 0, false)
    expect(legendLinks()).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Explore/ })).toHaveAttribute('href', '/http/routers')
  })
})
