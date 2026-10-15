// Tests ocultos del estudio.
/**
 * External dependencies
 */
import { render, screen } from '@testing-library/react';

/**
 * Internal dependencies
 */
import Progress from '../home/tasks-section/progress';

const count = ( container ) =>
	container.querySelector( '.sensei-home-task-progress__count' );

describe( 'T004 · contador de tareas', () => {
	it( 'muestra completadas sobre total después del porcentaje', () => {
		const { container } = render(
			<Progress totalTasks={ 5 } completedTasks={ 3 } showCount />
		);
		expect( count( container ).tagName ).toBe( 'SPAN' );
		expect( count( container ).textContent ).toBe( '3/5 tasks' );
		const number = container.querySelector(
			'.sensei-home-task-progress__number'
		);
		expect( number.nextElementSibling ).toBe( count( container ) );
	} );

	it( 'singular con una tarea', () => {
		const { container } = render(
			<Progress totalTasks={ 1 } completedTasks={ 1 } showCount />
		);
		expect( count( container ).textContent ).toBe( '1/1 task' );
	} );

	it( 'limita las completadas', () => {
		const { container } = render(
			<Progress totalTasks={ 5 } completedTasks={ 7 } showCount />
		);
		expect( count( container ).textContent ).toBe( '5/5 tasks' );
	} );

	it( 'sin showCount o sin tareas no aparece', () => {
		const { container, unmount } = render(
			<Progress totalTasks={ 5 } completedTasks={ 3 } />
		);
		expect( count( container ) ).toBeNull();
		unmount();
		const other = render(
			<Progress totalTasks={ 0 } completedTasks={ 0 } showCount />
		);
		expect( count( other.container ) ).toBeNull();
	} );

	it( 'el resto sigue igual', () => {
		render( <Progress totalTasks={ 4 } completedTasks={ 4 } showCount /> );
		expect( screen.getByText( 'All tasks completed' ) ).toBeInTheDocument();
		expect( screen.getByRole( 'progressbar' ) ).toHaveAttribute(
			'aria-valuenow',
			'100'
		);
	} );
} );
