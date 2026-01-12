const state = {
  table: null,
  me: { userId: null, displayName: null },
  lastMsg: null,
  actionLog: [],
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function addAction(message) {
  state.actionLog = [message, ...state.actionLog].slice(0, 20);
  for (const fn of listeners) fn(state);
}
