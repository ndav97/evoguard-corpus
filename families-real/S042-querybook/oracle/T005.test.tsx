// Tests ocultos del estudio.
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

import { IPaginationProps, Pagination } from 'ui/Pagination/Pagination';

let container: HTMLDivElement;
beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
});
afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
});

const renderPagination = (props: Partial<IPaginationProps> = {}) => {
    const onPageClick = props.onPageClick ?? jest.fn();
    act(() => {
        ReactDOM.render(
            <Pagination
                currentPage={4}
                totalPage={10}
                {...props}
                onPageClick={onPageClick}
            />,
            container
        );
    });
    return onPageClick;
};
const nav = () => container.querySelector('nav');
const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
    let notCancelled = true;
    act(() => {
        notCancelled = target.dispatchEvent(
            new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
        );
    });
    return notCancelled;
};

// T005 — Atajos de teclado.
describe('T005 · keyboardNavigation', () => {
    it('las flechas, Home y End cambian de página', () => {
        const onPageClick = renderPagination({ keyboardNavigation: true });
        expect(press(nav(), 'ArrowLeft')).toBe(false);
        expect(press(nav(), 'ArrowRight')).toBe(false);
        press(nav(), 'Home');
        press(nav(), 'End');
        expect(onPageClick.mock.calls).toEqual([[3], [5], [0], [9]]);
    });

    it('el nav se puede enfocar', () => {
        renderPagination({ keyboardNavigation: true });
        expect(nav().getAttribute('tabindex')).toBe('0');
    });

    it('también funciona desde un botón del interior', () => {
        const onPageClick = renderPagination({ keyboardNavigation: true });
        press(container.querySelector('.Pagination-page-button'), 'ArrowRight');
        expect(onPageClick).toHaveBeenCalledWith(5);
    });

    it('en los extremos no sale del rango pero sí evita la acción por defecto', () => {
        const onPageClick = renderPagination({ currentPage: 0, keyboardNavigation: true });
        expect(press(nav(), 'ArrowLeft')).toBe(false);
        expect(press(nav(), 'Home')).toBe(false);
        expect(onPageClick).not.toHaveBeenCalled();
        renderPagination({ currentPage: 9, keyboardNavigation: true, onPageClick });
        press(nav(), 'ArrowRight');
        press(nav(), 'End');
        expect(onPageClick).not.toHaveBeenCalled();
    });

    it('respeta disabled', () => {
        const onPageClick = renderPagination({ keyboardNavigation: true, disabled: true });
        press(nav(), 'ArrowRight');
        expect(onPageClick).not.toHaveBeenCalled();
    });

    it('ignora el campo Go to page, los modificadores y otras teclas', () => {
        const onPageClick = renderPagination({ keyboardNavigation: true, showJumpTo: true });
        const field = container.querySelector('input[aria-label="Go to page"]');
        expect(press(field, 'ArrowLeft')).toBe(true);
        expect(press(nav(), 'ArrowRight', { ctrlKey: true })).toBe(true);
        expect(press(nav(), 'ArrowRight', { altKey: true })).toBe(true);
        expect(press(nav(), 'ArrowRight', { metaKey: true })).toBe(true);
        expect(press(nav(), 'PageDown')).toBe(true);
        expect(onPageClick).not.toHaveBeenCalled();
    });

    it('sin keyboardNavigation no hay tabIndex ni atajos', () => {
        const onPageClick = renderPagination({});
        expect(nav().hasAttribute('tabindex')).toBe(false);
        expect(press(nav(), 'ArrowRight')).toBe(true);
        expect(onPageClick).not.toHaveBeenCalled();
    });

    it('el salto a una página sigue funcionando', () => {
        const onPageClick = renderPagination({ keyboardNavigation: true, showJumpTo: true });
        const field = container.querySelector<HTMLInputElement>('input[aria-label="Go to page"]');
        act(() => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, '8');
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        press(field, 'Enter');
        expect(onPageClick).toHaveBeenCalledWith(7);
    });
});
