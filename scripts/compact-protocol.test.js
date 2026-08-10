import { describe, expect, it } from 'vitest';
import { createDocumentFromTree } from '../src/domain/mindmap.js';
import { compactDocument, compactMutationResult, parseOutline } from './compact-protocol.mjs';

describe('compact mind-map protocol', () => {
  it('parses an indented outline and optional layout directive', () => {
    expect(parseOutline(`@layout architecture\nProduct plan\n  Goals\n    Adoption\n  Risks\n`)).toEqual({
      title: 'Product plan',
      layoutMode: 'architecture',
      root: {
        text: 'Product plan',
        children: [
          { text: 'Goals', children: [{ text: 'Adoption' }] },
          { text: 'Risks' },
        ],
      },
    });
  });

  it('accepts bullets without including bullet characters in node text', () => {
    expect(parseOutline('Topic\n  - First\n  - Second').root.children).toEqual([
      { text: 'First' }, { text: 'Second' },
    ]);
  });

  it('rejects invalid outlines', () => {
    expect(() => parseOutline('  Indented root')).toThrow('根节点不能缩进');
    expect(() => parseOutline('One\nTwo')).toThrow('只能有一个根节点');
    expect(() => parseOutline('@layout radial\nTopic')).toThrow('layout');
  });

  it('returns only structural fields in compact reads', () => {
    const document = createDocumentFromTree({
      id: 'root', text: 'Topic', children: [{ id: 'child', text: 'Child', color: '#fff' }],
    }, { revision: 4, layoutMode: 'top-bottom' });
    expect(compactDocument(document)).toEqual({
      revision: 4,
      title: 'Topic',
      layoutMode: 'top-bottom',
      scope: 'map',
      root: { id: 'root', text: 'Topic', children: [{ id: 'child', text: 'Child' }] },
    });
  });

  it('summarizes proposal output without echoing full documents', () => {
    const result = compactMutationResult({
      request: { id: 'request-1', status: 'review', baseRevision: 2, summary: { nodeCount: 3 } },
      previewDocument: { title: 'Topic', revision: 3, nodes: { a: {}, b: {}, c: {} } },
      document: { title: 'Old', revision: 2, nodes: { root: {} } },
    });
    expect(result).toEqual({
      request: { id: 'request-1', status: 'review', baseRevision: 2, summary: { nodeCount: 3 } },
      preview: { title: 'Topic', revision: 3, nodeCount: 3 },
      current: { title: 'Old', revision: 2, nodeCount: 1 },
    });
  });
});
