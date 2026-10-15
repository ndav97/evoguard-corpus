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

const field = (value: string) => ({ handle: { current: { value } } });

describe('T004 · varios campos', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('mide el campo con el foco', () => {
    const one = field('1 file');
    const other = field('%d files here');
    const { container } = mount({ fields: [one, other], focusField: other, source: '12345' });
    const div = container.querySelector('.translation-vs-original');
    expect(div?.childNodes[0].textContent).toBe('13');
    expect(div?.childNodes[2].textContent).toBe('5');
  });

  it('sin foco válido mide el primero', () => {
    const one = field('abc');
    const other = field('abcdef');
    const { container } = mount({ fields: [one, other], focusField: field('zzzzzzzz') });
    expect(
      container.querySelector('.translation-vs-original')?.childNodes[0].textContent,
    ).toBe('3');
  });

  it('también con MAX_LENGTH', () => {
    const one = field('<b>Hi</b>');
    const other = field('Hello there');
    const { container } = mount({
      fields: [one, other],
      focusField: one,
      comment: 'MAX_LENGTH: 5',
    });
    expect(container.querySelector('.countdown span')?.textContent).toBe('3');
  });

  it('sin campos o en vista de código no muestra nada', () => {
    expect(mount({ fields: [] }).container.firstChild).toBeNull();
    expect(
      mount({ fields: [field('a'), field('b')], sourceView: true }).container.firstChild,
    ).toBeNull();
  });
});
