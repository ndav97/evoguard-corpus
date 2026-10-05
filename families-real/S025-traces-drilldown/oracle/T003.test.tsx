// Tests ocultos del estudio.
import React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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


// T003 — Error al guardar visible dentro del diálogo.
describe('T003 · error al guardar dentro del diálogo', () => {
  test('si falla el guardado se muestra el error y el diálogo sigue abierto', async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error('quota exceeded'));
    setup();
    expect(screen.queryByText('Could not save the search')).not.toBeInTheDocument();
    typeTitle('Slow checkout');
    fireEvent.click(saveButton());
    expect(await screen.findByText('Could not save the search')).toBeInTheDocument();
    expect(screen.getByText('Please try again.')).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('tras el fallo se conserva lo escrito y se puede reintentar', async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error('quota exceeded')).mockResolvedValueOnce(undefined);
    setup();
    typeTitle('Slow checkout');
    typeDescription('p99');
    fireEvent.click(saveButton());
    await screen.findByText('Could not save the search');
    expect(titleInput()).toHaveValue('Slow checkout');
    expect(descriptionInput()).toHaveValue('p99');
    expect(titleInput()).toBeEnabled();
    expect(saveButton()).toBeEnabled();

    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
    expect(mockSaveSearch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Could not save the search')).not.toBeInTheDocument();
  });

  test('un guardado correcto no muestra el error', async () => {
    setup();
    typeTitle('Slow checkout');
    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
    expect(screen.queryByText('Could not save the search')).not.toBeInTheDocument();
  });
});
