import { describe, expect, it } from 'vitest';
import { lockNodeChangesToColumns, lockNodeChangesToLayout } from './flow.js';

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

  it('locks depth in top-bottom and architecture layouts', () => {
    const nodes = [{
      id: 'child',
      position: { x: 260, y: 108 },
      data: { isRootChild: false },
    }];
    const change = [{ id: 'child', type: 'position', position: { x: 410, y: 700 } }];
    expect(lockNodeChangesToLayout(change, nodes, 'root', 'top-bottom')[0].position).toEqual({ x: 410, y: 108 });
    expect(lockNodeChangesToLayout(change, nodes, 'root', 'architecture')[0].position).toEqual({ x: 410, y: 108 });
  });

  it('lets root branches move across the split axis', () => {
    const nodes = [{
      id: 'branch',
      position: { x: 260, y: 0 },
      data: { isRootChild: true },
    }];
    const change = [{ id: 'branch', type: 'position', position: { x: -260, y: 30 } }];
    expect(lockNodeChangesToLayout(change, nodes, 'root', 'left-right')[0].position).toEqual({ x: -260, y: 30 });
  });
});
