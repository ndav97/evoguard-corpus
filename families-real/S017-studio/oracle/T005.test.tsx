// Tests ocultos del estudio.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DATABASE_HOME_PATH, parseOmniboxInput, PreviewAddressBar } from '@/components/site-preview/address-bar';
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

// T005 — Atajos de una palabra para el escritorio y la base de datos.
describe( 'T005 · palabras clave de la barra', () => {
	it( 'admin y wp-admin llevan al escritorio, sin distinguir mayúsculas', () => {
		for ( const word of [ 'admin', 'wp-admin', ' Admin ', 'WP-ADMIN' ] ) {
			expect( parseOmniboxInput( word, SITE_URL ) ).toEqual( { type: 'path', path: '/wp-admin/' } );
		}
	} );

	it( 'database y phpmyadmin llevan a la base de datos', () => {
		for ( const word of [ 'database', 'phpMyAdmin' ] ) {
			expect( parseOmniboxInput( word, SITE_URL ) ).toEqual( { type: 'path', path: DATABASE_HOME_PATH } );
		}
	} );

	it( 'solo la palabra exacta: lo demás se interpreta como antes', () => {
		expect( parseOmniboxInput( 'administrator', SITE_URL ) ).toEqual( { type: 'search', term: 'administrator' } );
		expect( parseOmniboxInput( 'admin panel', SITE_URL ) ).toEqual( { type: 'search', term: 'admin panel' } );
		expect( parseOmniboxInput( 'wp-admin/plugins.php', SITE_URL ) ).toEqual( { type: 'path', path: '/wp-admin/plugins.php' } );
		expect( parseOmniboxInput( 'constructor', SITE_URL ) ).toEqual( { type: 'search', term: 'constructor' } );
	} );

	it( 'al enviar admin se navega con el acceso automático', () => {
		const { onNavigate } = renderBar();
		submit( 'admin' );
		expect( onNavigate ).toHaveBeenCalledWith(
			`/studio-auto-login?redirect_to=${ encodeURIComponent( `${ SITE_URL }/wp-admin/` ) }`
		);
	} );

	it( 'al enviar database se navega a phpMyAdmin', () => {
		const { onNavigate } = renderBar();
		submit( 'Database' );
		expect( onNavigate ).toHaveBeenCalledWith( DATABASE_HOME_PATH );
	} );
} );
