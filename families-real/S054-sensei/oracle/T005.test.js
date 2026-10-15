// Tests ocultos del estudio.
/**
 * External dependencies
 */
import { render, screen } from '@testing-library/react';

/**
 * Internal dependencies
 */
import Progress from '../home/tasks-section/progress';

const status = () => screen.getByRole( 'status' );

describe( 'T005 · anuncios', () => {
	it( 'empieza vacío aunque ya haya tareas completadas', () => {
		const { container } = render(
			<Progress totalTasks={ 10 } completedTasks={ 3 } />
		);
		expect( status().textContent ).toBe( '' );
		expect( status() ).toHaveClass( 'screen-reader-text' );
		expect(
			container.querySelector( '.sensei-home-task-progress' )
				.lastElementChild
		).toBe( status() );
	} );

	it( 'anuncia cada tarea completada', () => {
		const { rerender } = render(
			<Progress totalTasks={ 10 } completedTasks={ 3 } />
		);
		rerender( <Progress totalTasks={ 10 } completedTasks={ 4 } /> );
		expect( status().textContent ).toBe(
			'Task completed. 4 of 10 tasks completed'
		);
		rerender( <Progress totalTasks={ 10 } completedTasks={ 4 } /> );
		expect( status().textContent ).toBe(
			'Task completed. 4 of 10 tasks completed'
		);
	} );

	it( 'anuncia cuando se completan todas', () => {
		const { rerender } = render(
			<Progress totalTasks={ 2 } completedTasks={ 1 } />
		);
		rerender( <Progress totalTasks={ 2 } completedTasks={ 2 } /> );
		expect( status().textContent ).toBe( 'All tasks completed' );
	} );

	it( 'si disminuye se vacía', () => {
		const { rerender } = render(
			<Progress totalTasks={ 5 } completedTasks={ 1 } />
		);
		rerender( <Progress totalTasks={ 5 } completedTasks={ 2 } /> );
		rerender( <Progress totalTasks={ 5 } completedTasks={ 1 } /> );
		expect( status().textContent ).toBe( '' );
	} );

	it( 'los valores fuera de rango no cuentan como aumento', () => {
		const { rerender } = render(
			<Progress totalTasks={ 3 } completedTasks={ 3 } />
		);
		rerender( <Progress totalTasks={ 3 } completedTasks={ 9 } /> );
		expect( status().textContent ).toBe( '' );
	} );
} );
