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

const box = () => screen.getByTestId( 'validation-messages' );

describe( 'T004 · id y resumen', () => {
	test( 'usa el id recibido', () => {
		render( <ValidationMessages messages={ [ 'A' ] } id="my_field-messages" /> );
		expect( box() ).toHaveAttribute( 'id', 'my_field-messages' );
	} );

	test( 'sin id el contenedor no lo lleva', () => {
		render( <ValidationMessages messages={ [ 'A' ] } /> );
		expect( box().hasAttribute( 'id' ) ).toBe( false );
	} );

	test( 'resume cuántos mensajes hay, incluidos los ocultos', () => {
		render(
			<ValidationMessages
				messages={ [ 'A', 'B', 'B', { message: 'C', status: 'info' } ] }
				maxVisible={ 1 }
			/>
		);
		const summary = box().firstElementChild;
		expect( summary.tagName ).toBe( 'P' );
		expect( summary ).toHaveClass( 'screen-reader-text' );
		expect( summary ).toHaveTextContent( '3 validation messages' );
		expect( noticeTexts() ).toEqual( [ 'A' ] );
	} );

	test( 'con un solo mensaje no hay resumen', () => {
		render( <ValidationMessages messages={ [ 'A', ' A' ] } /> );
		expect( box().querySelector( '.screen-reader-text' ) ).toBeNull();
	} );
} );
