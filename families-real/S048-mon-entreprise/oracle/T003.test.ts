// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest'

import { generatePath, matchPath } from '@/lib/navigation/pathUtils'

// T003 — Consulta y fragmento.
describe('T003 · consulta y fragmento', () => {
	it('matchPath ignora la consulta y el fragmento', () => {
		expect(
			matchPath('/simulateurs/:slug', '/simulateurs/salaire?x=1#res')
		).toEqual({ params: { slug: 'salaire' } })
		expect(matchPath('/simulateurs/:slug', '/simulateurs/salaire/#res')).toEqual({
			params: { slug: 'salaire' },
		})
		expect(matchPath('/iframes/*', '/iframes/a/b?embed=1')).toEqual({
			params: { '*': 'a/b' },
		})
		expect(matchPath('/', '?a=1')).toEqual({ params: {} })
	})

	it('generatePath añade la consulta', () => {
		expect(
			generatePath('/s/:slug', { slug: 'salaire' }, { brut: 3000, temps: 'plein' })
		).toBe('/s/salaire?brut=3000&temps=plein')
		expect(
			generatePath('/s', {}, { actif: true, vide: '', a: null, b: undefined })
		).toBe('/s?actif=true&vide=')
		expect(generatePath('/s', {}, { q: 'café crème' })).toBe(
			'/s?q=caf%C3%A9+cr%C3%A8me'
		)
	})

	it('sin valores no añade ?', () => {
		expect(generatePath('/s', {}, { a: undefined })).toBe('/s')
		expect(generatePath('/s', {}, {})).toBe('/s')
		expect(generatePath('/s', {})).toBe('/s')
	})

	it('sin params devuelve el patrón con la consulta', () => {
		expect(generatePath('/a/:x', undefined, { p: 2 })).toBe('/a/:x?p=2')
	})

	it('los opcionales siguen funcionando', () => {
		expect(
			generatePath('/simulateurs/:slug/:etape?', { slug: 'x' }, { y: 1 })
		).toBe('/simulateurs/x?y=1')
	})
})
