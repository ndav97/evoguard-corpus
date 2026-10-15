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
const click = (el: Element) =>
    act(() => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
const first = () => container.querySelector('.Pagination-first .Button');
const last = () => container.querySelector('.Pagination-last .Button');
const follows = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

// T003 — Botones First y Last.
describe('T003 · showEdgeButtons', () => {
    it('First y Last llevan a los extremos', () => {
        const onPageClick = renderPagination({
            currentPage: 5,
            totalPage: 20,
            showEdgeButtons: true,
        });
        expect(first().textContent).toContain('First');
        expect(last().textContent).toContain('Last');
        click(first());
        click(last());
        expect(onPageClick.mock.calls).toEqual([[0], [19]]);
    });

    it('First va antes de Previous y Last después de Next', () => {
        renderPagination({ currentPage: 5, showEdgeButtons: true });
        const firstBox = container.querySelector('.Pagination-first');
        const lastBox = container.querySelector('.Pagination-last');
        expect(follows(firstBox, container.querySelector('.Pagination-previous'))).toBe(true);
        expect(follows(container.querySelector('.Pagination-next'), lastBox)).toBe(true);
    });

    it('se ocultan en los extremos como Previous y Next', () => {
        renderPagination({ currentPage: 0, showEdgeButtons: true });
        expect(container.querySelector('.Pagination-first')).not.toBeNull();
        expect(first()).toBeNull();
        expect(last()).not.toBeNull();
        renderPagination({ currentPage: 9, showEdgeButtons: true });
        expect(first()).not.toBeNull();
        expect(last()).toBeNull();
        renderPagination({ currentPage: 0, totalPage: 0, showEdgeButtons: true });
        expect(last()).toBeNull();
    });

    it('hideNavButton oculta los cuatro', () => {
        renderPagination({ currentPage: 5, showEdgeButtons: true, hideNavButton: true });
        expect(container.querySelector('.Pagination-first')).toBeNull();
        expect(container.querySelector('.Pagination-last')).toBeNull();
        expect(container.querySelector('.Pagination-previous')).toBeNull();
    });

    it('respetan disabled', () => {
        const onPageClick = renderPagination({
            currentPage: 5,
            showEdgeButtons: true,
            disabled: true,
        });
        click(first());
        click(last());
        expect(onPageClick).not.toHaveBeenCalled();
    });

    it('sin showEdgeButtons no aparecen', () => {
        renderPagination({ currentPage: 5 });
        expect(container.querySelector('.Pagination-first')).toBeNull();
        expect(container.querySelector('.Pagination-last')).toBeNull();
        expect(container.textContent).not.toMatch(/First|Last/);
    });

    it('showPageInfo sigue funcionando', () => {
        renderPagination({ currentPage: 5, showEdgeButtons: true, showPageInfo: true });
        expect(container.querySelector('.Pagination-info').textContent).toBe('Page 6 of 10');
    });
});
