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
import { countCharacters } from '~/modules/editor/components/TranslationLength';

describe('T002 · caracteres visibles', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('cuenta grupos de grafemas', () => {
    expect(countCharacters('abc')).toBe(3);
    expect(countCharacters('👍🏽')).toBe(1);
    expect(countCharacters('été')).toBe(3);
    expect(countCharacters('👨‍👩‍👧')).toBe(1);
    expect(countCharacters('')).toBe(0);
  });

  it('usa esa cuenta para la traducción y el original', () => {
    const { container } = mount({ source: 'ok 👍🏽', translation: 'vale 👍🏽👍🏽' });
    const div = container.querySelector('.translation-vs-original');
    expect(div?.childNodes[0].textContent).toBe('7');
    expect(div?.childNodes[1].textContent).toBe('|');
    expect(div?.childNodes[2].textContent).toBe('4');
  });

  it('y para la cuenta atrás', () => {
    const { container } = mount({ translation: 'café ☕️', comment: 'MAX_LENGTH: 10' });
    expect(container.querySelector('.countdown span')?.textContent).toBe('4');
  });
});
