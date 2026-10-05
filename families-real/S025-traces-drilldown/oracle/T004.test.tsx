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


// T004 — Estado de guardado y limpieza del error.
describe('T004 · botón «Saving...» y el error se borra al editar', () => {
  test('mientras se guarda el botón dice «Saving...» y está deshabilitado', async () => {
    let finish: () => void = () => {};
    mockSaveSearch.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );
    setup();
    typeTitle('Slow checkout');
    fireEvent.click(saveButton());
    const saving = await screen.findByRole('button', { name: 'Saving...' });
    expect(saving).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    await act(async () => {
      finish();
    });
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  test('si falla, el botón vuelve a decir «Save»', async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error('quota exceeded'));
    setup();
    typeTitle('Slow checkout');
    fireEvent.click(saveButton());
    await screen.findByText('Could not save the search');
    expect(screen.queryByRole('button', { name: 'Saving...' })).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  test('editar el título oculta el error anterior', async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error('quota exceeded'));
    setup();
    typeTitle('Slow checkout');
    fireEvent.click(saveButton());
    await screen.findByText('Could not save the search');
    typeTitle('Slow checkout 2');
    expect(screen.queryByText('Could not save the search')).not.toBeInTheDocument();
    expect(titleInput()).toHaveValue('Slow checkout 2');
  });

  test('editar la descripción también oculta el error', async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error('quota exceeded'));
    setup();
    typeTitle('Slow checkout');
    fireEvent.click(saveButton());
    await screen.findByText('Could not save the search');
    typeDescription('p99');
    expect(screen.queryByText('Could not save the search')).not.toBeInTheDocument();
  });
});
