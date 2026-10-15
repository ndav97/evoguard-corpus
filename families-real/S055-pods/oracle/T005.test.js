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

const dismissButtons = () =>
	screen.queryAllByRole( 'button', { name: 'Dismiss this notice' } );

describe( 'T005 · descartar mensajes', () => {
	test( 'con onDismiss los avisos son descartables', () => {
		render( <ValidationMessages messages={ [ 'A', 'B' ] } onDismiss={ jest.fn() } /> );
		screen.getAllByTestId( 'mock-notice' ).forEach( ( notice ) => {
			expect( notice ).toHaveAttribute( 'data-dismissible', 'true' );
		} );
	} );

	test( 'descartar oculta el mensaje y avisa con su texto y status', () => {
		const onDismiss = jest.fn();
		render(
			<ValidationMessages
				messages={ [ 'Required', { message: 'Long value', status: 'warning' } ] }
				onDismiss={ onDismiss }
			/>
		);
		fireEvent.click( dismissButtons()[ 1 ] );
		expect( onDismiss ).toHaveBeenCalledWith( { message: 'Long value', status: 'warning' } );
		expect( noticeTexts() ).toEqual( [ 'Required' ] );
	} );

	test( 'los descartados no cuentan para maxVisible ni para el resumen', () => {
		render(
			<ValidationMessages
				messages={ [ 'A', 'B', 'C' ] }
				maxVisible={ 1 }
				onDismiss={ jest.fn() }
			/>
		);
		fireEvent.click( dismissButtons()[ 0 ] );
		expect( noticeTexts() ).toEqual( [ 'B' ] );
		expect( screen.getByRole( 'button', { name: 'Show 1 more message' } ) ).toBeInTheDocument();
		expect( screen.getByText( '2 validation messages' ) ).toBeInTheDocument();
	} );

	test( 'si se descartan todos no muestra nada', () => {
		const { container } = render(
			<ValidationMessages messages={ [ 'A' ] } onDismiss={ jest.fn() } />
		);
		fireEvent.click( dismissButtons()[ 0 ] );
		expect( container ).toBeEmptyDOMElement();
	} );

	test( 'vuelve a mostrarse si desaparece y regresa', () => {
		const onDismiss = jest.fn();
		const { rerender } = render(
			<ValidationMessages messages={ [ 'A', 'B' ] } onDismiss={ onDismiss } />
		);
		fireEvent.click( dismissButtons()[ 0 ] );
		rerender( <ValidationMessages messages={ [ 'A', 'B' ] } onDismiss={ onDismiss } /> );
		expect( noticeTexts() ).toEqual( [ 'B' ] );
		rerender( <ValidationMessages messages={ [ 'B' ] } onDismiss={ onDismiss } /> );
		rerender( <ValidationMessages messages={ [ 'A', 'B' ] } onDismiss={ onDismiss } /> );
		expect( noticeTexts() ).toEqual( [ 'A', 'B' ] );
	} );

	test( 'sin onDismiss no son descartables', () => {
		render( <ValidationMessages messages={ [ 'A' ] } /> );
		expect( screen.getByTestId( 'mock-notice' ) ).toHaveAttribute( 'data-dismissible', 'false' );
		expect( dismissButtons() ).toHaveLength( 0 );
	} );
} );
