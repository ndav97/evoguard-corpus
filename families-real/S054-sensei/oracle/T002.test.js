// Tests ocultos del estudio.
/**
 * External dependencies
 */
import { render, screen } from '@testing-library/react';

/**
 * Internal dependencies
 */
import Progress, { getProgressText } from '../home/tasks-section/progress';

describe( 'T002 · progreso accesible', () => {
	it( 'describe el progreso con plural según el total', () => {
		expect( getProgressText( 10, 3 ) ).toBe( '3 of 10 tasks completed' );
		expect( getProgressText( 1, 1 ) ).toBe( '1 of 1 task completed' );
		expect( getProgressText( 2, 0 ) ).toBe( '0 of 2 tasks completed' );
	} );

	it( 'limita las completadas al rango', () => {
		expect( getProgressText( 4, 9 ) ).toBe( '4 of 4 tasks completed' );
		expect( getProgressText( 4, -2 ) ).toBe( '0 of 4 tasks completed' );
		expect( getProgressText( 4, NaN ) ).toBe( '0 of 4 tasks completed' );
	} );

	it( 'sin tareas', () => {
		expect( getProgressText( 0, 0 ) ).toBe( 'No tasks yet' );
		expect( getProgressText( undefined, 2 ) ).toBe( 'No tasks yet' );
	} );

	it( 'la barra expone el rango y la descripción', () => {
		render( <Progress totalTasks={ 10 } completedTasks={ 5 } /> );
		const bar = screen.getByRole( 'progressbar' );
		expect( bar ).toHaveAttribute( 'aria-valuemin', '0' );
		expect( bar ).toHaveAttribute( 'aria-valuemax', '100' );
		expect( bar ).toHaveAttribute( 'aria-valuenow', '50' );
		expect( bar ).toHaveAttribute(
			'aria-valuetext',
			'5 of 10 tasks completed'
		);
	} );

	it( 'sin tareas la barra lo dice', () => {
		render( <Progress totalTasks={ 0 } completedTasks={ 0 } /> );
		expect( screen.getByRole( 'progressbar' ) ).toHaveAttribute(
			'aria-valuetext',
			'No tasks yet'
		);
	} );
} );
