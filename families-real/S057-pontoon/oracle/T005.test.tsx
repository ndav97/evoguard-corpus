// Tests ocultos del estudio.
import React, { useContext } from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { EditorData, EditorResult } from '~/context/Editor';
import { EntityView } from '~/context/EntityView';
import { TranslationLength } from '~/modules/editor/components/TranslationLength';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useContext: vi.fn() };
});

type MountOptions = {
  source?: string;
  translation?: string;
  comment?: string;
  format?: string;
  fields?: unknown[];
  focusField?: unknown;
  sourceView?: boolean;
};

function mount({
  source = '12345',
  translation = '',
  comment = '',
  format = '',
  fields = [{}],
  focusField = null,
  sourceView = false,
}: MountOptions) {
  const context = new Map<unknown, unknown>([
    [EditorData, { sourceView, fields, focusField: { current: focusField } }],
    [EditorResult, { value: [translation] }],
    [EntityView, { entity: { key: ['id'], comment, format, value: [source] } }],
  ]);
  vi.mocked(useContext).mockImplementation((key) => context.get(key));
  return render(<TranslationLength />);
}
import {
  LONG_TRANSLATION_MIN_SOURCE,
  LONG_TRANSLATION_RATIO,
} from '~/modules/editor/components/TranslationLength';

const comparison = (container: HTMLElement) =>
  container.querySelector('.translation-vs-original');

describe('T005 · traducciones demasiado largas', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('exporta los umbrales', () => {
    expect(LONG_TRANSLATION_RATIO).toBe(1.5);
    expect(LONG_TRANSLATION_MIN_SOURCE).toBe(10);
  });

  it('marca una traducción más de 1,5 veces más larga', () => {
    const { container } = mount({ source: '0123456789', translation: '0123456789012345' });
    expect(comparison(container)).toHaveClass('too-long');
    expect(comparison(container)).toHaveClass('translation-vs-original');
    expect(comparison(container)?.textContent).toBe('16|10');
  });

  it('justo en el límite no se marca', () => {
    const { container } = mount({ source: '0123456789', translation: '012345678901234' });
    expect(comparison(container)).not.toHaveClass('too-long');
  });

  it('con originales cortos no se marca', () => {
    const { container } = mount({ source: '123456789', translation: '1234567890123456789012' });
    expect(comparison(container)).not.toHaveClass('too-long');
  });

  it('cuenta caracteres visibles', () => {
    const { container } = mount({
      source: '0123456789',
      translation: '👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽👍🏽',
    });
    expect(comparison(container)).not.toHaveClass('too-long');
  });

  it('con MAX_LENGTH no hay comparación', () => {
    const { container } = mount({
      source: '0123456789',
      translation: '0123456789012345',
      comment: 'MAX_LENGTH: 20',
    });
    expect(comparison(container)).toBeNull();
  });
});
