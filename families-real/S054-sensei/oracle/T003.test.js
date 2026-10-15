// Tests ocultos del estudio.
/**
 * External dependencies
 */
import { render, screen } from '@testing-library/react';

/**
 * Internal dependencies
 */
import Progress from '../home/tasks-section/progress';

const root = ( container ) =>
	container.querySelector( '.sensei-home-task-progress' );

describe( 'T003 · estado completado', () => {
	it( 'marca el progreso completo y lo dice', () => {
		const { container } = render(
			<Progress totalTasks={ 6 } completedTasks={ 6 } />
		);
		expect( root( container ) ).toHaveClass(
			'sensei-home-task-progress--complete'
		);
		const done = screen.getByText( 'All tasks completed' );
		expect( done.tagName ).toBe( 'SPAN' );
		expect( done ).toHaveClass( 'sensei-home-task-progress__done' );
		const bar = container.querySelector(
			'.sensei-home-task-progress__bar'
		);
		expect(
			bar.compareDocumentPosition( done ) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	} );

	it( 'también con más completadas que tareas', () => {
		const { container } = render(
			<Progress totalTasks={ 3 } completedTasks={ 5 } />
		);
		expect( root( container ) ).toHaveClass(
			'sensei-home-task-progress--complete'
		);
	} );

	it( 'sin completar no hay marca ni texto', () => {
		const { container } = render(
			<Progress totalTasks={ 6 } completedTasks={ 5 } />
		);
		expect( root( container ).className ).toBe(
			'sensei-home-task-progress'
		);
		expect( screen.queryByText( 'All tasks completed' ) ).toBeNull();
	} );

	it( 'sin tareas no cuenta como completado', () => {
		const { container } = render(
			<Progress totalTasks={ 0 } completedTasks={ 0 } />
		);
		expect( root( container ).className ).toBe(
			'sensei-home-task-progress'
		);
		expect( screen.queryByText( 'All tasks completed' ) ).toBeNull();
	} );

	it( 'mantiene la información accesible', () => {
		render( <Progress totalTasks={ 2 } completedTasks={ 2 } /> );
		expect( screen.getByRole( 'progressbar' ) ).toHaveAttribute(
			'aria-valuetext',
			'2 of 2 tasks completed'
		);
	} );
} );
