// Tests ocultos del estudio.
/**
 * External dependencies
 */
import { render, screen } from '@testing-library/react';

/**
 * Internal dependencies
 */
import Progress, {
	getProgressPercentage,
} from '../home/tasks-section/progress';

describe( 'T001 · porcentaje de progreso', () => {
	it( 'redondea el porcentaje', () => {
		expect( getProgressPercentage( 3, 1 ) ).toBe( 33 );
		expect( getProgressPercentage( 3, 2 ) ).toBe( 67 );
		expect( getProgressPercentage( 8, 8 ) ).toBe( 100 );
	} );

	it( 'sin tareas es 0', () => {
		expect( getProgressPercentage( 0, 0 ) ).toBe( 0 );
		expect( getProgressPercentage( 0, 3 ) ).toBe( 0 );
		expect( getProgressPercentage( -2, 1 ) ).toBe( 0 );
		expect( getProgressPercentage( undefined, 1 ) ).toBe( 0 );
		expect( getProgressPercentage( 5, NaN ) ).toBe( 0 );
		expect( getProgressPercentage( 5, undefined ) ).toBe( 0 );
	} );

	it( 'se limita entre 0 y 100', () => {
		expect( getProgressPercentage( 4, 6 ) ).toBe( 100 );
		expect( getProgressPercentage( 4, -1 ) ).toBe( 0 );
	} );

	it( 'Progress no muestra NaN sin tareas', () => {
		const { container } = render(
			<Progress totalTasks={ 0 } completedTasks={ 0 } />
		);
		const bar = screen.getByRole( 'progressbar' );
		expect( bar.getAttribute( 'aria-valuenow' ) ).toBe( '0' );
		expect( bar.style.width ).toBe( '0%' );
		expect( container.textContent ).not.toMatch( /NaN/ );
		expect(
			container.querySelector( '.sensei-home-task-progress__number' )
				.textContent
		).toBe( '0%' );
	} );

	it( 'Progress limita los datos inconsistentes', () => {
		render( <Progress totalTasks={ 4 } completedTasks={ 6 } /> );
		expect(
			screen.getByRole( 'progressbar' ).getAttribute( 'aria-valuenow' )
		).toBe( '100' );
	} );
} );
