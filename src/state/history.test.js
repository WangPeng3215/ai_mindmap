import { describe, expect, it } from 'vitest';
import { createHistory, historyReducer } from './history.js';

describe('document history', () => {
  it('commits, undoes and redoes document states', () => {
    let history = createHistory({ title: 'A' });
    history = historyReducer(history, { type: 'commit', value: { title: 'B' } });
    history = historyReducer(history, { type: 'undo' });
    expect(history.present.title).toBe('A');
    history = historyReducer(history, { type: 'redo' });
    expect(history.present.title).toBe('B');
  });

  it('clears redo states after a new commit', () => {
    let history = createHistory({ title: 'A' });
    history = historyReducer(history, { type: 'commit', value: { title: 'B' } });
    history = historyReducer(history, { type: 'undo' });
    history = historyReducer(history, { type: 'commit', value: { title: 'C' } });

    expect(history.future).toEqual([]);
    expect(historyReducer(history, { type: 'redo' }).present.title).toBe('C');
  });

  it('resets history for an external document replacement', () => {
    let history = createHistory({ title: 'A' });
    history = historyReducer(history, { type: 'commit', value: { title: 'B' } });
    history = historyReducer(history, { type: 'reset', value: { title: 'External' } });

    expect(history).toEqual({ past: [], present: { title: 'External' }, future: [] });
  });
});
