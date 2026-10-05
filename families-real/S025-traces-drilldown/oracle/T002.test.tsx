// Tests ocultos del estudio.
import React from 'react';

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { sceneGraph, SceneObject } from '@grafana/scenes';

import { SaveSearchModal } from '../components/Explore/SavedSearches/SaveSearchModal';
import { SavedSearch, useCheckForExistingSearch, useSavedSearches } from '../components/Explore/SavedSearches/saveSearch';
import { renderTraceQLLabelFilters } from '../utils/filters-renderer';
import { getFiltersVariable, getTraceExplorationScene } from '../utils/utils';

jest.mock('../components/Explore/SavedSearches/saveSearch');
jest.mock('../utils/utils');
jest.mock('../utils/filters-renderer');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppEvents: jest.fn(() => ({
    publish: jest.fn(),
  })),
  reportInteraction: jest.fn(),
}));

const mockUseSavedSearches = jest.mocked(useSavedSearches);
const mockSaveSearch = jest.fn();
const mockOnClose = jest.fn();

const saved = (title: string, uid: string): SavedSearch => ({
  description: '',
  dsUid: 'test-ds',
  query: `{span.name="${uid}"}`,
  timestamp: 1700000000000,
  title,
  uid,
});

const setup = (searches: SavedSearch[] = []) => {
  mockUseSavedSearches.mockReturnValue({
    saveSearch: mockSaveSearch,
    isLoading: false,
    searches,
    deleteSearch: jest.fn(),
  });
  return render(<SaveSearchModal dsUid="test-ds" onClose={mockOnClose} sceneRef={{} as unknown as SceneObject} />);
};

const titleInput = () => screen.getByLabelText(/title/i);
const saveButton = () => screen.getByRole('button', { name: /^save$/i });
const typeTitle = (value: string) => fireEvent.change(titleInput(), { target: { value } });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(useCheckForExistingSearch).mockReturnValue(undefined);
  jest.mocked(renderTraceQLLabelFilters).mockReturnValue('{job="test"}');
  jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({} as unknown as SceneObject);
  jest.mocked(getTraceExplorationScene).mockReturnValue({} as ReturnType<typeof getTraceExplorationScene>);
  jest.mocked(getFiltersVariable).mockReturnValue({
    state: { filters: [] },
    useState: () => ({ filters: [] }),
  } as unknown as ReturnType<typeof getFiltersVariable>);
  mockSaveSearch.mockResolvedValue(undefined);
});


// T002 — Títulos repetidos.
describe('T002 · título ya usado por otra búsqueda guardada', () => {
  test('avisa si el título ya existe, sin distinguir mayúsculas ni espacios', () => {
    setup([saved('Errors in checkout', 'a'), saved('Slow DB calls', 'b')]);
    expect(screen.queryByText('This title is already in use')).not.toBeInTheDocument();
    typeTitle('  errors IN checkout ');
    expect(screen.getByText('This title is already in use')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  test('un título nuevo no muestra el aviso y se puede guardar', async () => {
    setup([saved('Errors in checkout', 'a')]);
    typeTitle('Errors in payments');
    expect(screen.queryByText('This title is already in use')).not.toBeInTheDocument();
    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(mockSaveSearch).toHaveBeenCalledWith(expect.objectContaining({ title: 'Errors in payments' }));
    });
  });

  test('el aviso desaparece al cambiar el título', () => {
    setup([saved('Errors in checkout', 'a')]);
    typeTitle('Errors in checkout');
    expect(screen.getByText('This title is already in use')).toBeInTheDocument();
    typeTitle('Errors in checkout v2');
    expect(screen.queryByText('This title is already in use')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  test('enviar el formulario con un título repetido no guarda', async () => {
    setup([saved('Errors in checkout', 'a')]);
    typeTitle('Errors in checkout');
    fireEvent.submit(titleInput().closest('form') as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSaveSearch).not.toHaveBeenCalled();
  });

  test('sigue recortando el título y sin título en blanco', () => {
    setup([saved('Errors in checkout', 'a')]);
    typeTitle('  ');
    expect(screen.queryByText('This title is already in use')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });
});
