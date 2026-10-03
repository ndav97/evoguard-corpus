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

// T002 — Borrar los destinos recientes.
describe( 'T002 · borrar recientes', () => {
	it( 'el botón Clear recent aparece en la sección Recent', async () => {
		renderBar();
		submit( '/about/' );
		const popup = await openShortcuts();
		expect( within( popup ).getByText( 'Recent' ) ).toBeVisible();
		expect( within( popup ).getByRole( 'button', { name: 'Clear recent' } ) ).toBeVisible();
	} );

	it( 'vacía la lista sin navegar y la olvida para este sitio', async () => {
		const { onNavigate, unmount } = renderBar();
		submit( '/about/' );
		submit( '/contact/' );
		onNavigate.mockClear();
		const popup = await openShortcuts();
		fireEvent.click( within( popup ).getByRole( 'button', { name: 'Clear recent' } ) );
		await waitFor( () => expect( screen.queryByText( 'Recent' ) ).not.toBeInTheDocument() );
		expect( onNavigate ).not.toHaveBeenCalled();
		unmount();

		renderBar();
		const again = await openShortcuts();
		expect( within( again ).queryByText( 'Recent' ) ).not.toBeInTheDocument();
	} );

	it( 'solo borra los del sitio actual', async () => {
		window.localStorage.setItem(
			'studio-preview-recent-locations:site-2',
			JSON.stringify( { version: 1, locations: [ { path: '/x/', label: 'http://localhost:9999/x/' } ] } )
		);
		renderBar();
		submit( '/about/' );
		const popup = await openShortcuts();
		fireEvent.click( within( popup ).getByRole( 'button', { name: 'Clear recent' } ) );
		expect( window.localStorage.getItem( 'studio-preview-recent-locations:site-2' ) ).not.toBeNull();
	} );

	it( 'sin recientes no hay botón', async () => {
		renderBar();
		const popup = await openShortcuts();
		expect( within( popup ).queryByRole( 'button', { name: 'Clear recent' } ) ).not.toBeInTheDocument();
	} );
} );
