export function createHistory(value) {
  return { past: [], present: value, future: [] };
}

export function historyReducer(state, action) {
  switch (action.type) {
    case 'commit':
      return {
        past: [...state.past.slice(-49), state.present],
        present: action.value,
        future: [],
      };
    case 'undo':
      if (!state.past.length) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    case 'redo':
      if (!state.future.length) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
      };
    case 'reset':
      return createHistory(action.value);
    default:
      return state;
  }
}
