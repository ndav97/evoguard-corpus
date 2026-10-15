// Tests ocultos del estudio.
import { describe, expect, it } from 'vitest'

import { matchPaths } from '@/lib/navigation/pathUtils'

// T004 — Patrón más específico.
describe('T004 · matchPaths', () => {
	const patterns = [
		'/simulateurs/*',
		'/simulateurs/:slug',
		'/simulateurs/salaire',
		'/simulateurs/:slug/:etape?',
		'/:page',
	]

	it('los segmentos fijos ganan a los parámetros y al comodín', () => {
		expect(matchPaths(patterns, '/simulateurs/salaire')).toEqual({
			pattern: '/simulateurs/salaire',
			params: {},
		})
	})

	it('un parámetro obligatorio gana a uno opcional y al comodín', () => {
		expect(matchPaths(patterns, '/simulateurs/chômage')).toEqual({
			pattern: '/simulateurs/:slug',
			params: { slug: 'chômage' },
		})
		expect(matchPaths(patterns, '/simulateurs/x/resultat?a=1')).toEqual({
			pattern: '/simulateurs/:slug/:etape?',
			params: { slug: 'x', etape: 'resultat' },
		})
	})

	it('el comodín queda para lo que no encaja en otro patrón', () => {
		expect(matchPaths(patterns, '/simulateurs/a/b/c')).toEqual({
			pattern: '/simulateurs/*',
			params: { '*': 'a/b/c' },
		})
	})

	it('con empate gana el primero de la lista', () => {
		expect(matchPaths(['/:a', '/:b'], '/x')).toEqual({
			pattern: '/:a',
			params: { a: 'x' },
		})
		expect(matchPaths(['/:b', '/:a'], '/x')?.pattern).toBe('/:b')
	})

	it('null si ninguno encaja, y no modifica la lista', () => {
		const copy = [...patterns]
		expect(matchPaths(patterns, '/a/b/c/d')).toBeNull()
		expect(patterns).toEqual(copy)
		expect(matchPaths([], '/')).toBeNull()
	})
})
