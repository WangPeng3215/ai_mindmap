import { describe, expect, it } from 'vitest';
import { createDocumentFromTree } from './mindmap.js';
import { createProposalPreview } from './proposal.js';

function sampleDocument() {
  return createDocumentFromTree({
    id: 'root',
    text: 'Plan',
    children: [
      { id: 'goals', text: 'Goals' },
      { id: 'risks', text: 'Risks' },
    ],
  }, { revision: 2 });
}

describe('proposal preview', () => {
  it('previews selected operations and marks changed nodes', () => {
    const current = sampleDocument();
    const preview = createProposalPreview(current, {
      baseRevision: 2,
      proposal: {
        operations: [
          { type: 'update_node', id: 'goals', patch: { text: 'New goals' } },
          { type: 'add_node', parentId: 'risks', node: { id: 'budget', text: 'Budget' } },
        ],
      },
    }, [1]);

    expect(preview.document.nodes.goals.text).toBe('Goals');
    expect(preview.document.nodes.budget.text).toBe('Budget');
    expect(preview.changes).toEqual({ budget: 'added' });
  });

  it('previews a complete replacement without mutating the current map', () => {
    const current = sampleDocument();
    const preview = createProposalPreview(current, {
      baseRevision: 2,
      proposal: {
        document: { title: 'Roadmap', root: { id: 'roadmap', text: 'Roadmap' } },
      },
    });

    expect(preview.document.title).toBe('Roadmap');
    expect(preview.changes.roadmap).toBe('preview');
    expect(current.nodes.roadmap).toBeUndefined();
  });

  it('rejects previews based on an old revision', () => {
    expect(() => createProposalPreview(sampleDocument(), {
      baseRevision: 1,
      proposal: { operations: [{ type: 'update_node', id: 'goals', patch: { text: 'Old' } }] },
    })).toThrow('旧版本');
  });
});
