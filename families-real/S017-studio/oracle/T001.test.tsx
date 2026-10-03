// Tests ocultos del estudio.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseOmniboxInput, PreviewAddressBar } from '@/components/site-preview/address-bar';
import type { SiteDetails } from '@/data/core';

const SITE_URL = 'http://localhost:8881';
const SITE = {
	id: 'site-1',
	name: 'Example Site',
	path: '/Users/example/Studio/example-site',
	port: 8881,
	running: true,
	phpVersion: '8.3',
} as SiteDetails;

function renderBar( path = '/', onNavigate = vi.fn() ) {
	const result = render(
		<PreviewAddressBar
			site={ SITE }
			siteUrl={ SITE_URL }
			path={ path }
			onNavigate={ onNavigate }
			onSwitchRealm={ vi.fn() }
		/>
	);
	return { ...result, onNavigate };
}

const address = () => screen.getByRole( 'textbox', { name: 'Address' } );

function submit( value: string ) {
	fireEvent.change( address(), { target: { value } } );
	fireEvent.submit( address().closest( 'form' )! );
}

async function openShortcuts() {
	fireEvent.click( address() );
	return screen.findByRole( 'dialog', { name: 'Preview shortcuts' } );
}

beforeEach( () => window.localStorage.clear() );

// T001 — La dirección del sitio escrita sin esquema.
describe( 'T001 · dirección del sitio sin http://', () => {
	it( 'host y puerto con ruta, consulta y fragmento', () => {
		expect( parseOmniboxInput( 'localhost:8881/about/?x=1#top', SITE_URL ) ).toEqual( {
			type: 'path',
			path: '/about/?x=1#top',
		} );
	} );

	it( 'solo el host va a la portada', () => {
		expect( parseOmniboxInput( 'localhost:8881', SITE_URL ) ).toEqual( { type: 'path', path: '/' } );
		expect( parseOmniboxInput( '  localhost:8881/  ', SITE_URL ) ).toEqual( { type: 'path', path: '/' } );
	} );

	it( 'no distingue mayúsculas en el host y admite consulta directa', () => {
		expect( parseOmniboxInput( 'LocalHost:8881?p=2', SITE_URL ) ).toEqual( { type: 'path', path: '/?p=2' } );
	} );

	it( 'otro puerto u otro host no es la dirección del sitio', () => {
		expect( parseOmniboxInput( 'localhost:8882/about', SITE_URL ) ).toEqual( {
			type: 'path',
			path: '/localhost:8882/about',
		} );
		expect( parseOmniboxInput( 'localhost:88811', SITE_URL ) ).toEqual( { type: 'search', term: 'localhost:88811' } );
	} );

	it( 'el formulario navega a la ruta y una ruta de wp-admin pasa por el acceso automático', () => {
		const { onNavigate } = renderBar();
		submit( 'localhost:8881/contact/' );
		expect( onNavigate ).toHaveBeenLastCalledWith( '/contact/' );
		submit( 'localhost:8881/wp-admin/' );
		expect( onNavigate ).toHaveBeenLastCalledWith(
			`/studio-auto-login?redirect_to=${ encodeURIComponent( `${ SITE_URL }/wp-admin/` ) }`
		);
	} );
} );
