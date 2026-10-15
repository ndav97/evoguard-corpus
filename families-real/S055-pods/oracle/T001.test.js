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

describe( 'T001 · mensajes repetidos o vacíos', () => {
	test( 'muestra una sola vez los mensajes repetidos, en orden', () => {
		render(
			<ValidationMessages
				messages={ [ 'Required', 'Too long', ' Required ', 'Too long' ] }
			/>
		);
		expect( noticeTexts() ).toEqual( [ 'Required', 'Too long' ] );
	} );

	test( 'conserva el texto original del primero', () => {
		render( <ValidationMessages messages={ [ '  Spaced  ', 'Spaced' ] } /> );
		expect( noticeTexts() ).toEqual( [ '  Spaced  ' ] );
	} );

	test( 'descarta los mensajes vacíos', () => {
		render( <ValidationMessages messages={ [ '', '   ', 'Invalid' ] } /> );
		expect( noticeTexts() ).toEqual( [ 'Invalid' ] );
	} );

	test( 'sin mensajes útiles no muestra nada', () => {
		const { container } = render(
			<ValidationMessages messages={ [ '', '  ' ] } />
		);
		expect( container ).toBeEmptyDOMElement();
	} );

	test( 'sin messages no falla', () => {
		const { container } = render( <ValidationMessages messages={ null } /> );
		expect( container ).toBeEmptyDOMElement();
	} );

	test( 'los mensajes distintos se ven como siempre', () => {
		render( <ValidationMessages messages={ [ 'A', 'B' ] } /> );
		const notices = screen.getAllByTestId( 'mock-notice' );
		expect( notices ).toHaveLength( 2 );
		expect( notices[ 0 ] ).toHaveAttribute( 'data-status', 'error' );
		expect( notices[ 0 ] ).toHaveAttribute( 'data-dismissible', 'false' );
	} );
} );
