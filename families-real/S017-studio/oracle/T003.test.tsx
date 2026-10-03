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

// T003 — La página actual no aparece entre los recientes.
describe( 'T003 · ocultar la página actual en Recent', () => {
	it( 'no lista el destino que ya se está mostrando', async () => {
		const first = renderBar();
		submit( '/about/' );
		submit( '/contact/' );
		first.unmount();

		renderBar( '/about/' );
		const popup = await openShortcuts();
		expect( within( popup ).getByRole( 'button', { name: `${ SITE_URL }/contact/` } ) ).toBeVisible();
		expect( within( popup ).queryByRole( 'button', { name: `${ SITE_URL }/about/` } ) ).not.toBeInTheDocument();
	} );

	it( 'si el único reciente es la página actual, no hay sección Recent ni botón para borrar', async () => {
		const first = renderBar();
		submit( '/about/' );
		first.unmount();

		renderBar( '/about/' );
		const popup = await openShortcuts();
		expect( within( popup ).queryByText( 'Recent' ) ).not.toBeInTheDocument();
		expect( within( popup ).queryByRole( 'button', { name: 'Clear recent' } ) ).not.toBeInTheDocument();
	} );

	it( 'el destino oculto se conserva y vuelve a aparecer desde otra página', async () => {
		const first = renderBar();
		submit( '/about/' );
		first.unmount();

		const second = renderBar( '/about/' );
		await openShortcuts();
		second.unmount();

		renderBar( '/' );
		const popup = await openShortcuts();
		expect( within( popup ).getByRole( 'button', { name: `${ SITE_URL }/about/` } ) ).toBeVisible();
	} );
} );
