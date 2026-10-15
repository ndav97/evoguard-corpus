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

describe('T003 · etiquetas en la cuenta atrás', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('no cuenta las etiquetas HTML', () => {
    const { container } = mount({
      translation: '12<span class="x">34</span>56',
      comment: 'MAX_LENGTH: 10',
    });
    expect(container.querySelector('.countdown span')?.textContent).toBe('4');
  });

  it('los signos sueltos sí cuentan', () => {
    const { container } = mount({ translation: 'a < b', comment: 'MAX_LENGTH: 10' });
    expect(container.querySelector('.countdown span')?.textContent).toBe('5');
  });

  it('el modo normal sigue contando las etiquetas', () => {
    const { container } = mount({ translation: '12<b>3</b>' });
    expect(
      container.querySelector('.translation-vs-original')?.childNodes[0].textContent,
    ).toBe('10');
  });

  it('el exceso se calcula sin etiquetas', () => {
    const { container } = mount({
      translation: '<a href="https://example.com">Click here now</a>',
      comment: 'MAX_LENGTH: 12',
    });
    const span = container.querySelector('.countdown span');
    expect(span?.textContent).toBe('-2');
    expect(span).toHaveClass('overflow');
  });
});
