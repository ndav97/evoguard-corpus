// Tests ocultos del estudio.
import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { useKuadrantDataViewPagination } from '../components/KuadrantDataView';

const params = () => new URLSearchParams(window.location.search);

afterEach(() => window.history.replaceState({}, '', '/'));

// T004 — Página y tamaño de página en la URL.
describe('T004 · paginación en la URL', () => {
  it('sin urlKey no lee ni escribe la URL', () => {
    window.history.replaceState({}, '', '/list?policies.page=3');
    const { result } = renderHook(() => useKuadrantDataViewPagination(50, 10));
    expect(result.current.page).toBe(1);
    act(() => result.current.onSetPage(undefined, 2));
    expect(window.location.search).toBe('?policies.page=3');
  });

  it('con urlKey lee la página y el tamaño iniciales', () => {
    window.history.replaceState({}, '', '/list?policies.page=3&policies.perPage=20');
    const { result } = renderHook(() => useKuadrantDataViewPagination(100, 10, 'policies'));
    expect(result.current.page).toBe(3);
    expect(result.current.perPage).toBe(20);
  });

  it('ignora valores que no son enteros positivos', () => {
    window.history.replaceState({}, '', '/list?policies.page=abc&policies.perPage=0');
    const { result } = renderHook(() => useKuadrantDataViewPagination(100, 10, 'policies'));
    expect(result.current.page).toBe(1);
    expect(result.current.perPage).toBe(10);
  });

  it('guarda los cambios conservando los demás parámetros y el hash', () => {
    window.history.replaceState({}, '', '/list?view=all#top');
    const { result } = renderHook(() => useKuadrantDataViewPagination(100, 10, 'policies'));
    act(() => result.current.onSetPage(undefined, 4));
    expect(params().get('policies.page')).toBe('4');
    expect(params().get('policies.perPage')).toBe('10');
    act(() => result.current.onPerPageSelect(undefined, 50));
    expect(params().get('policies.page')).toBe('1');
    expect(params().get('policies.perPage')).toBe('50');
    expect(params().get('view')).toBe('all');
    expect(window.location.pathname).toBe('/list');
    expect(window.location.hash).toBe('#top');
  });

  it('cada tabla usa su propia clave', () => {
    const first = renderHook(() => useKuadrantDataViewPagination(100, 10, 'first'));
    const second = renderHook(() => useKuadrantDataViewPagination(100, 10, 'second'));
    act(() => first.result.current.onSetPage(undefined, 2));
    act(() => second.result.current.onSetPage(undefined, 5));
    expect(params().get('first.page')).toBe('2');
    expect(params().get('second.page')).toBe('5');
  });

  it('una página fuera de rango se ajusta y la URL lo refleja', () => {
    window.history.replaceState({}, '', '/?policies.page=9');
    const { result } = renderHook(() => useKuadrantDataViewPagination(25, 10, 'policies'));
    expect(result.current.page).toBe(3);
    expect(params().get('policies.page')).toBe('3');
  });
});
