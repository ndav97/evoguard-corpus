// Tests ocultos del estudio.
/**
 * External dependencies
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Internal dependencies
 */
import ValidationMessages from '../../components/validation-messages';

jest.mock(
	'@wordpress/components',
	() => (
		{
			Notice: ( {
				children,
				status,
				isDismissible,
				politeness,
				onRemove,
			} ) => (
				<div
					data-testid="mock-notice"
					data-status={ status }
					data-dismissible={ isDismissible ? 'true' : 'false' }
					data-politeness={ politeness }
				>
					{ children }
					{ isDismissible ? (
						<button type="button" onClick={ onRemove }>
							Dismiss this notice
						</button>
					) : null }
				</div>
			),
		}
	),
);

const noticeTexts = () =>
	screen.queryAllByTestId( 'mock-notice' ).map( ( notice ) => notice.firstChild.textContent );

const statuses = () =>
	screen.queryAllByTestId( 'mock-notice' ).map( ( notice ) => notice.getAttribute( 'data-status' ) );

describe( 'T003 · status de los mensajes', () => {
	test( 'acepta objetos con status y ordena por gravedad', () => {
		render(
			<ValidationMessages
				messages={ [
					{ message: 'Long value', status: 'warning' },
					'Required',
					{ message: 'Saved as draft', status: 'info' },
					{ message: 'Invalid URL', status: 'error' },
					{ message: 'Unusual', status: 'warning' },
				] }
			/>
		);
		expect( noticeTexts() ).toEqual( [
			'Required',
			'Invalid URL',
			'Long value',
			'Unusual',
			'Saved as draft',
		] );
		expect( statuses() ).toEqual( [ 'error', 'error', 'warning', 'warning', 'info' ] );
	} );

	test( 'un status ausente o desconocido es error', () => {
		render(
			<ValidationMessages
				messages={ [ { message: 'X' }, { message: 'Y', status: 'fatal' } ] }
			/>
		);
		expect( statuses() ).toEqual( [ 'error', 'error' ] );
	} );

	test( 'descarta lo que no es un mensaje', () => {
		render(
			<ValidationMessages
				messages={ [ { message: '  ' }, { status: 'warning' }, 'Ok' ] }
			/>
		);
		expect( noticeTexts() ).toEqual( [ 'Ok' ] );
	} );

	test( 'repetidos según texto y status', () => {
		render(
			<ValidationMessages
				messages={ [
					'Check value',
					{ message: 'Check value', status: 'warning' },
					{ message: ' Check value ', status: 'error' },
				] }
			/>
		);
		expect( noticeTexts() ).toEqual( [ 'Check value', 'Check value' ] );
		expect( statuses() ).toEqual( [ 'error', 'warning' ] );
	} );

	test( 'maxVisible se aplica después de ordenar', () => {
		render(
			<ValidationMessages
				messages={ [ { message: 'W', status: 'warning' }, 'E1', 'E2' ] }
				maxVisible={ 2 }
			/>
		);
		expect( noticeTexts() ).toEqual( [ 'E1', 'E2' ] );
		expect(
			screen.getByRole( 'button', { name: 'Show 1 more message' } )
		).toBeInTheDocument();
	} );
} );
