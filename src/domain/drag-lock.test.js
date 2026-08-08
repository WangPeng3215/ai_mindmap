import { describe, expect, it } from 'vitest';
import { lockNodeChangesToColumns } from './flow.js';

describe('drag column lock', () => {
  it('allows vertical dragging but keeps the aligned horizontal column', () => {
    const nodes = [
      { id: 'root', position: { x: 0, y: 0 } },
      { id: 'child', position: { x: 260, y: 0 } },
    ];
    const changes = [{
      id: 'child',
      type: 'position',
      position: { x: 935, y: 146 },
      dragging: true,
    }];

    expect(lockNodeChangesToColumns(changes, nodes, 'root')).toEqual([{
      id: 'child',
      type: 'position',
      position: { x: 260, y: 146 },
      dragging: true,
    }]);
  });
});
