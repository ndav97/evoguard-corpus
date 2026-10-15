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
import { getMaxLength } from '~/modules/editor/components/TranslationLength';

describe('T001 · MAX_LENGTH', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('lee el límite del comentario', () => {
    expect(getMaxLength('MAX_LENGTH: 25')).toBe(25);
    expect(getMaxLength('Button label\nMAX_LENGTH:12  \nMAX_LENGTH: 40')).toBe(12);
    expect(getMaxLength('Max length is 25')).toBeNull();
    expect(getMaxLength('see MAX_LENGTH: 25')).toBeNull();
    expect(getMaxLength('')).toBeNull();
    expect(getMaxLength(undefined)).toBeNull();
  });

  it('muestra los caracteres que quedan', () => {
    const { container } = mount({ translation: '1234567', comment: 'MAX_LENGTH: 10' });
    const span = container.querySelector('.translation-length .countdown span');
    expect(span?.textContent).toBe('3');
    expect(span?.hasAttribute('class')).toBe(false);
    expect(container.querySelector('.translation-vs-original')).toBeNull();
  });

  it('marca el exceso', () => {
    const { container } = mount({ translation: '1234567', comment: 'MAX_LENGTH: 5' });
    const span = container.querySelector('.countdown span');
    expect(span?.textContent).toBe('-2');
    expect(span).toHaveClass('overflow');
  });

  it('sin límite muestra la comparación de siempre', () => {
    const { container } = mount({ translation: '1234567', comment: 'Just a comment' });
    expect(container.querySelector('.countdown')).toBeNull();
    const div = container.querySelector('.translation-vs-original');
    expect(div?.textContent).toBe('7|5');
  });

  it('en vista de código fuente no muestra nada', () => {
    const { container } = mount({ comment: 'MAX_LENGTH: 5', sourceView: true });
    expect(container.firstChild).toBeNull();
  });
});
