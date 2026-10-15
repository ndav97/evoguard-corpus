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
                currentPage={0}
                totalPage={50}
                {...props}
                onPageClick={onPageClick}
            />,
            container
        );
    });
    return onPageClick;
};
const field = () =>
    container.querySelector<HTMLInputElement>('input[aria-label="Go to page"]');
const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
).set;
const type = (text: string) =>
    act(() => {
        setter.call(field(), text);
        field().dispatchEvent(new Event('input', { bubbles: true }));
    });
const enter = () =>
    act(() => {
        field().dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
    });

// T004 — Campo para saltar a una página.
describe('T004 · showJumpTo', () => {
    it('salta a la página escrita (restando el shift) y vacía el campo', () => {
        const onPageClick = renderPagination({ showJumpTo: true });
        expect(container.querySelector('.Pagination-jump').contains(field())).toBe(true);
        type(' 37 ');
        enter();
        expect(onPageClick).toHaveBeenCalledWith(36);
        expect(field().value).toBe('');
    });

    it('con shift 0 el número es la página', () => {
        const onPageClick = renderPagination({ showJumpTo: true, shift: 0 });
        type('12');
        enter();
        expect(onPageClick).toHaveBeenCalledWith(12);
    });

    it('ajusta al rango', () => {
        const onPageClick = renderPagination({ currentPage: 3, showJumpTo: true });
        type('999');
        enter();
        type('-4');
        enter();
        expect(onPageClick.mock.calls).toEqual([[49], [0]]);
    });

    it('un texto que no es entero marca el campo y no navega', () => {
        const onPageClick = renderPagination({ showJumpTo: true });
        type('3.5');
        enter();
        expect(onPageClick).not.toHaveBeenCalled();
        expect(field().value).toBe('3.5');
        expect(field().getAttribute('aria-invalid')).toBe('true');
        type('3');
        expect(field().getAttribute('aria-invalid')).not.toBe('true');
        enter();
        expect(onPageClick).toHaveBeenCalledWith(2);
    });

    it('la página actual no vuelve a llamar a onPageClick', () => {
        const onPageClick = renderPagination({ currentPage: 4, showJumpTo: true });
        type('5');
        enter();
        expect(onPageClick).not.toHaveBeenCalled();
    });

    it('con disabled el campo está desactivado', () => {
        renderPagination({ showJumpTo: true, disabled: true });
        expect(field().disabled).toBe(true);
    });

    it('va después de la lista y del texto de página', () => {
        renderPagination({ showJumpTo: true, showPageInfo: true });
        const info = container.querySelector('.Pagination-info');
        const jump = container.querySelector('.Pagination-jump');
        expect(Boolean(info.compareDocumentPosition(jump) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
        expect(container.querySelector('.Pagination-pages').contains(jump)).toBe(false);
    });

    it('no aparece sin showJumpTo ni sin páginas', () => {
        renderPagination({});
        expect(field()).toBeNull();
        renderPagination({ showJumpTo: true, totalPage: 0 });
        expect(field()).toBeNull();
    });
});
