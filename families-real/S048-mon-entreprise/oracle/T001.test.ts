// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest'

import { generatePath, matchPath } from '@/lib/navigation/pathUtils'

// T001 — Codificación de parámetros.
describe('T001 · codificación', () => {
	it('decodifica los parámetros', () => {
		expect(
			matchPath('/simulateurs/:slug', '/simulateurs/location-de-meubl%C3%A9')
		).toEqual({ params: { slug: 'location-de-meublé' } })
		expect(matchPath('/a/:x', '/a/hello%20world')).toEqual({
			params: { x: 'hello world' },
		})
	})

	it('compara los segmentos fijos ya decodificados', () => {
		expect(
			matchPath(
				'/simulateurs/location-de-meublé',
				'/simulateurs/location-de-meubl%C3%A9'
			)
		).toEqual({ params: {} })
		expect(matchPath('/caf%C3%A9', '/café')).toBeNull()
	})

	it('decodifica el comodín segmento a segmento', () => {
		expect(matchPath('/iframes/*', '/iframes/a%2Fb/c%C3%A9')).toEqual({
			params: { '*': 'a/b/cé' },
		})
	})

	it('una codificación mal formada se usa tal cual', () => {
		expect(matchPath('/a/:x', '/a/%E0%A4%A')).toEqual({
			params: { x: '%E0%A4%A' },
		})
	})

	it('generatePath codifica los valores', () => {
		expect(generatePath('/a/:x', { x: 'a/b c' })).toBe('/a/a%2Fb%20c')
		expect(generatePath('/simulateurs/:slug', { slug: 'meublé' })).toBe(
			'/simulateurs/meubl%C3%A9'
		)
		expect(generatePath('/a/:x/:y', { x: 'ok' })).toBe('/a/ok/')
	})

	it('ida y vuelta', () => {
		const path = generatePath('/r/:name', { name: 'Côte d’Ivoire ?' })
		expect(matchPath('/r/:name', path)).toEqual({
			params: { name: 'Côte d’Ivoire ?' },
		})
	})
})
