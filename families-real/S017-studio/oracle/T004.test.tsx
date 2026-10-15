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

const KEY = 'studio-preview-recent-locations:site-1';
const storedPaths = () => ( JSON.parse( window.localStorage.getItem( KEY ) ?? 'null' )?.locations ?? [] ).map( ( l: { path: string } ) => l.path );

// T004 — Quitar un destino reciente concreto.
describe( 'T004 · quitar un reciente', () => {
	it( 'cada destino reciente tiene un botón para quitarlo', async () => {
		const first = renderBar();
		submit( '/about/' );
		submit( '/contact/' );
		first.unmount();

		renderBar( '/' );
		const popup = await openShortcuts();
		expect( within( popup ).getByRole( 'button', { name: `Remove ${ SITE_URL }/about/ from recent` } ) ).toBeVisible();
		expect( within( popup ).getByRole( 'button', { name: `Remove ${ SITE_URL }/contact/ from recent` } ) ).toBeVisible();
	} );

	it( 'quita solo ese destino, de la lista y del almacenamiento, sin navegar', async () => {
		const first = renderBar();
		submit( '/about/' );
		submit( '/contact/' );
		first.unmount();

		const { onNavigate } = renderBar( '/' );
		const popup = await openShortcuts();
		fireEvent.click( within( popup ).getByRole( 'button', { name: `Remove ${ SITE_URL }/about/ from recent` } ) );
		expect( within( popup ).queryByRole( 'button', { name: `${ SITE_URL }/about/` } ) ).not.toBeInTheDocument();
		expect( within( popup ).getByRole( 'button', { name: `${ SITE_URL }/contact/` } ) ).toBeVisible();
		expect( storedPaths() ).toEqual( [ '/contact/' ] );
		expect( onNavigate ).not.toHaveBeenCalled();
		expect( screen.getByRole( 'dialog', { name: 'Preview shortcuts' } ) ).toBeInTheDocument();
	} );

	it( 'al quitar el último desaparece la sección Recent', async () => {
		const first = renderBar();
		submit( '/about/' );
		first.unmount();

		renderBar( '/' );
		const popup = await openShortcuts();
		fireEvent.click( within( popup ).getByRole( 'button', { name: `Remove ${ SITE_URL }/about/ from recent` } ) );
		await waitFor( () => expect( within( popup ).queryByText( 'Recent' ) ).not.toBeInTheDocument() );
		expect( storedPaths() ).toEqual( [] );
	} );

	it( 'el destino de la página actual oculto no se borra al quitar otro', async () => {
		const first = renderBar();
		submit( '/about/' );
		submit( '/contact/' );
		first.unmount();

		renderBar( '/about/' );
		const popup = await openShortcuts();
		fireEvent.click( within( popup ).getByRole( 'button', { name: `Remove ${ SITE_URL }/contact/ from recent` } ) );
		expect( storedPaths() ).toEqual( [ '/about/' ] );
	} );

	it( '«Clear recent» sigue borrándolos todos', async () => {
		const first = renderBar();
		submit( '/about/' );
		submit( '/contact/' );
		first.unmount();

		renderBar( '/' );
		const popup = await openShortcuts();
		fireEvent.click( within( popup ).getByRole( 'button', { name: 'Clear recent' } ) );
		expect( window.localStorage.getItem( KEY ) ).toBeNull();
	} );
} );
