// Tests ocultos del estudio.
import React from 'react';

import { act, fireEvent, render, waitFor, screen } from '@testing-library/react';

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


// T001 — Título obligatorio sin espacios sobrantes.
describe('T001 · título y descripción recortados', () => {
  test('un título hecho solo de espacios no permite guardar', () => {
    setup();
    typeTitle('   ');
    expect(saveButton()).toBeDisabled();
  });

  test('guarda el título y la descripción sin espacios al principio ni al final', async () => {
    setup();
    typeTitle('  Slow checkout  ');
    typeDescription('  p99 above 2s ');
    expect(saveButton()).toBeEnabled();
    fireEvent.click(saveButton());
    await waitFor(() => {
      expect(mockSaveSearch).toHaveBeenCalledWith({
        description: 'p99 above 2s',
        dsUid: 'test-ds',
        query: '{job="test"}',
        title: 'Slow checkout',
      });
    });
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('enviar el formulario con un título en blanco no guarda nada', async () => {
    setup();
    typeTitle('   ');
    fireEvent.submit(titleInput().closest('form') as HTMLFormElement);
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockSaveSearch).not.toHaveBeenCalled();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
