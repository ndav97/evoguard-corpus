// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest'

import { generatePath, matchPath } from '@/lib/navigation/pathUtils'

const pattern = '/simulateurs/:slug/:etape?'

// T002 — Parámetros opcionales.
describe('T002 · parámetros opcionales', () => {
	it('matchPath acepta la ruta con y sin el segmento opcional', () => {
		expect(matchPath(pattern, '/simulateurs/salaire')).toEqual({
			params: { slug: 'salaire' },
		})
		expect(matchPath(pattern, '/simulateurs/salaire/resultat/')).toEqual({
			params: { slug: 'salaire', etape: 'resultat' },
		})
		expect(matchPath(pattern, '/simulateurs')).toBeNull()
		expect(matchPath(pattern, '/simulateurs/a/b/c')).toBeNull()
	})

	it('el parámetro opcional ausente no aparece en params', () => {
		const match = matchPath(pattern, '/simulateurs/salaire')
		expect(match && 'etape' in match.params).toBe(false)
	})

	it('varios opcionales y en medio del patrón', () => {
		expect(matchPath('/:lang?/docs/:page?', '/docs')).toEqual({ params: {} })
		expect(matchPath('/:lang?/docs/:page?', '/fr/docs')).toEqual({
			params: { lang: 'fr' },
		})
		expect(matchPath('/:lang?/docs/:page?', '/docs/intro')).toEqual({
			params: { page: 'intro' },
		})
		expect(matchPath('/:a?/:b?', '/x')).toEqual({ params: { a: 'x' } })
	})

	it('decodifica también los opcionales', () => {
		expect(matchPath(pattern, '/simulateurs/x/r%C3%A9sultat')).toEqual({
			params: { slug: 'x', etape: 'résultat' },
		})
	})

	it('generatePath omite el segmento sin valor', () => {
		expect(generatePath(pattern, { slug: 'salaire' })).toBe(
			'/simulateurs/salaire'
		)
		expect(generatePath(pattern, { slug: 'salaire', etape: '' })).toBe(
			'/simulateurs/salaire'
		)
		expect(generatePath(pattern, { slug: 'salaire', etape: 'é' })).toBe(
			'/simulateurs/salaire/%C3%A9'
		)
		expect(generatePath('/:lang?/docs', {})).toBe('/docs')
		expect(generatePath('/:lang?', {})).toBe('/')
	})

	it('sin opcionales todo sigue igual', () => {
		expect(generatePath('/a/:x/:y', { x: '1' })).toBe('/a/1/')
		expect(generatePath('/a/:x')).toBe('/a/:x')
		expect(matchPath('/a/:x', '/a')).toBeNull()
	})
})
