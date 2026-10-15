// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest'

import { generatePath, matchPath } from '@/lib/navigation/pathUtils'

// T005 — Comodín en generatePath.
describe('T005 · generatePath con comodín', () => {
	it('sustituye el comodín final', () => {
		expect(generatePath('/iframes/*', { '*': 'simulateur/salaire' })).toBe(
			'/iframes/simulateur/salaire'
		)
		expect(generatePath('/iframes/*', { '*': 'a b/é' })).toBe(
			'/iframes/a%20b/%C3%A9'
		)
		expect(generatePath('/iframes/*', { '*': '/a//b/' })).toBe('/iframes/a/b')
	})

	it('sin valor queda el prefijo', () => {
		expect(generatePath('/iframes/*', {})).toBe('/iframes')
		expect(generatePath('/iframes/*', { '*': '' })).toBe('/iframes')
		expect(generatePath('/*', {})).toBe('/')
	})

	it('se combina con parámetros, opcionales y consulta', () => {
		expect(
			generatePath('/:lang?/iframes/*', { lang: 'fr', '*': 'x' }, { embed: 1 })
		).toBe('/fr/iframes/x?embed=1')
		expect(generatePath('/:lang?/iframes/*', { '*': 'x/y' })).toBe(
			'/iframes/x/y'
		)
	})

	it('un * que no está al final no se toca, y sin params todo sigue igual', () => {
		expect(generatePath('/a/*/b', {})).toBe('/a/*/b')
		expect(generatePath('/iframes/*')).toBe('/iframes/*')
	})

	it('ida y vuelta con matchPath', () => {
		const path = generatePath('/iframes/*', { '*': 'dossier/café noir' })
		expect(matchPath('/iframes/*', path)).toEqual({
			params: { '*': 'dossier/café noir' },
		})
	})
})
