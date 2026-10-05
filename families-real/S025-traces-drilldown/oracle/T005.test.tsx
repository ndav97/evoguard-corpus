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
const descriptionInput = () => screen.getByLabelText(/description/i);
const saveButton = () => screen.getByRole('button', { name: /^save$/i });
const typeTitle = (value: string) => fireEvent.change(titleInput(), { target: { value } });
const typeDescription = (value: string) => fireEvent.change(descriptionInput(), { target: { value } });

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


// T005 — Longitud máxima del título y la descripción.
describe('T005 · límites de longitud', () => {
  test('un título de más de 60 caracteres muestra el error y no se puede guardar', () => {
    setup();
    typeTitle('t'.repeat(61));
    expect(screen.getByText('Use 60 characters or fewer')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  test('60 caracteres son válidos y los espacios de los extremos no cuentan', async () => {
    setup();
    typeTitle(`  ${'t'.repeat(60)}  `);
    expect(screen.queryByText('Use 60 characters or fewer')).not.toBeInTheDocument();
    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(mockSaveSearch).toHaveBeenCalledWith(expect.objectContaining({ title: 't'.repeat(60) }));
    });
  });

  test('una descripción de más de 200 caracteres muestra el error y no se puede guardar', () => {
    setup();
    typeTitle('Slow checkout');
    typeDescription('d'.repeat(201));
    expect(screen.getByText('Use 200 characters or fewer')).toBeInTheDocument();
    expect(screen.queryByText('Use 60 characters or fewer')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    typeDescription('d'.repeat(200));
    expect(screen.queryByText('Use 200 characters or fewer')).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  test('enviar el formulario con un texto demasiado largo no guarda', async () => {
    setup();
    typeTitle('t'.repeat(61));
    fireEvent.submit(titleInput().closest('form') as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSaveSearch).not.toHaveBeenCalled();
  });

  test('el aviso de título repetido se mantiene', () => {
    setup([saved('Errors in checkout', 'a')]);
    typeTitle('Errors in checkout');
    expect(screen.getByText('This title is already in use')).toBeInTheDocument();
  });
});
