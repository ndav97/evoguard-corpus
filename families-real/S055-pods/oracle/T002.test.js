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

const toggle = () =>
	screen.queryByRole( 'button', { name: /^Show (\d+ more|fewer) messages?$/ } );

describe( 'T002 · maxVisible', () => {
	test( 'muestra los primeros y un botón para el resto', () => {
		render(
			<ValidationMessages
				messages={ [ 'A', 'B', 'C', 'D' ] }
				maxVisible={ 2 }
			/>
		);
		expect( noticeTexts() ).toEqual( [ 'A', 'B' ] );
		expect( toggle() ).toHaveTextContent( 'Show 2 more messages' );
		expect( toggle() ).toHaveAttribute( 'aria-expanded', 'false' );
		expect( toggle() ).toHaveAttribute( 'type', 'button' );
		expect( toggle() ).toHaveClass( 'pods-validation-messages__toggle' );
	} );

	test( 'singular con un mensaje oculto, contando sin repetidos', () => {
		render(
			<ValidationMessages
				messages={ [ 'A', 'A', 'B', '', 'C' ] }
				maxVisible={ 2 }
			/>
		);
		expect( toggle() ).toHaveTextContent( 'Show 1 more message' );
	} );

	test( 'el botón alterna entre todos y los primeros', () => {
		render(
			<ValidationMessages messages={ [ 'A', 'B', 'C' ] } maxVisible={ 1 } />
		);
		fireEvent.click( toggle() );
		expect( noticeTexts() ).toEqual( [ 'A', 'B', 'C' ] );
		expect( toggle() ).toHaveTextContent( 'Show fewer messages' );
		expect( toggle() ).toHaveAttribute( 'aria-expanded', 'true' );
		fireEvent.click( toggle() );
		expect( noticeTexts() ).toEqual( [ 'A' ] );
	} );

	test( 'sin mensajes de más, o con un límite no válido, no hay botón', () => {
		const { unmount } = render(
			<ValidationMessages messages={ [ 'A', 'B' ] } maxVisible={ 2 } />
		);
		expect( toggle() ).toBeNull();
		unmount();
		for ( const maxVisible of [ 0, -1, 1.5 ] ) {
			const view = render(
				<ValidationMessages messages={ [ 'A', 'B' ] } maxVisible={ maxVisible } />
			);
			expect( noticeTexts() ).toEqual( [ 'A', 'B' ] );
			expect( toggle() ).toBeNull();
			view.unmount();
		}
	} );
} );
