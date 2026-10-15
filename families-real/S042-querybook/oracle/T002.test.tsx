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
const pageButton = (label: string) =>
    Array.from(container.querySelectorAll('.Pagination-page-button')).find(
        (b) => b.textContent === label
    );
const nav = () => container.querySelector('nav');

// T002 — disabled y página actual.
describe('T002 · disabled', () => {
    it('con disabled ningún botón llama a onPageClick', () => {
        const onPageClick = renderPagination({ currentPage: 4, disabled: true });
        click(pageButton('6'));
        click(pageButton('1'));
        click(container.querySelector('.Pagination-previous .Button'));
        click(container.querySelector('.Pagination-next .Button'));
        expect(onPageClick).not.toHaveBeenCalled();
        expect(pageButton('6')).toBeTruthy();
    });

    it('marca el nav como desactivado', () => {
        renderPagination({ currentPage: 4, disabled: true });
        expect(nav().classList.contains('Pagination--disabled')).toBe(true);
        expect(nav().getAttribute('aria-disabled')).toBe('true');
    });

    it('sin disabled el nav no lleva marcas y los botones funcionan', () => {
        const onPageClick = renderPagination({ currentPage: 4 });
        expect(nav().classList.contains('Pagination--disabled')).toBe(false);
        expect(nav().hasAttribute('aria-disabled')).toBe(false);
        click(pageButton('7'));
        click(container.querySelector('.Pagination-next .Button'));
        click(container.querySelector('.Pagination-previous .Button'));
        expect(onPageClick.mock.calls).toEqual([[6], [5], [3]]);
    });

    it('la página actual no vuelve a llamar a onPageClick', () => {
        const onPageClick = renderPagination({ currentPage: 2 });
        click(pageButton('3'));
        expect(onPageClick).not.toHaveBeenCalled();
        click(pageButton('1'));
        expect(onPageClick).toHaveBeenCalledWith(0);
    });

    it('nunca pide una página fuera del rango', () => {
        const onPageClick = renderPagination({ currentPage: 12, totalPage: 10 });
        const next = container.querySelector('.Pagination-next .Button');
        if (next) {
            click(next);
        }
        click(container.querySelector('.Pagination-previous .Button'));
        expect(onPageClick).not.toHaveBeenCalledWith(13);
        expect(onPageClick).not.toHaveBeenCalledWith(11);
    });

    it('showPageInfo sigue funcionando junto a disabled', () => {
        renderPagination({ currentPage: 1, disabled: true, showPageInfo: true });
        expect(container.querySelector('.Pagination-info').textContent).toBe(
            'Page 2 of 10'
        );
    });
});
