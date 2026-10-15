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
                totalPage={10}
                {...props}
                onPageClick={onPageClick}
            />,
            container
        );
    });
    return onPageClick;
};
const info = () => container.querySelector('.Pagination-info');

// T001 — Página actual y total.
describe('T001 · showPageInfo', () => {
    it('muestra la página actual y la última con el shift por defecto', () => {
        renderPagination({ currentPage: 3, totalPage: 12, showPageInfo: true });
        expect(info()).not.toBeNull();
        expect(info().textContent).toBe('Page 4 of 12');
        expect(info().getAttribute('aria-live')).toBe('polite');
    });

    it('aplica el shift de los botones', () => {
        renderPagination({
            currentPage: 2,
            totalPage: 5,
            shift: 0,
            showPageInfo: true,
        });
        expect(info().textContent).toBe('Page 2 of 4');
    });

    it('sin páginas dice No pages', () => {
        renderPagination({ currentPage: 0, totalPage: 0, showPageInfo: true });
        expect(info().textContent).toBe('No pages');
    });

    it('va después de la lista de páginas', () => {
        renderPagination({ currentPage: 1, showPageInfo: true });
        const list = container.querySelector('.Pagination-pages');
        expect(list.compareDocumentPosition(info()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(list.contains(info())).toBe(false);
    });

    it('sin showPageInfo no aparece', () => {
        renderPagination({ currentPage: 1 });
        expect(info()).toBeNull();
        expect(container.textContent).not.toMatch(/Page \d+ of/);
    });

    it('se actualiza al cambiar de página', () => {
        renderPagination({ currentPage: 1, showPageInfo: true });
        renderPagination({ currentPage: 7, showPageInfo: true });
        expect(info().textContent).toBe('Page 8 of 10');
    });
});
