/**
 * Utility functions for managing undo/redo history in stores
 */

/**
 * State for managing undo/redo history
 */
export interface HistoryState<T> {
  history: T[];
  historyIndex: number;
}

/**
 * Push a new item to history, truncating any redo states
 * @param state Current history state
 * @param item New item to push
 * @returns Updated history state
 */
export function pushToHistory<T>(
  state: HistoryState<T>,
  item: T
): HistoryState<T> {
  const truncated = state.history.slice(0, state.historyIndex + 1);
  return {
    history: [...truncated, item],
    historyIndex: truncated.length,
  };
}

/**
 * Undo to the previous history state
 * @param state Current history state
 * @returns Updated history state and the previous item, or null if at beginning
 */
export function undo<T>(state: HistoryState<T>): {
  state: HistoryState<T>;
  item: T | null;
} {
  if (state.historyIndex <= 0) {
    return { state, item: null };
  }
  const newIndex = Math.max(state.historyIndex - 2, 0);
  return {
    state: { ...state, historyIndex: newIndex },
    item: state.history[newIndex] ?? null,
  };
}

/**
 * Redo to the next history state
 * @param state Current history state
 * @returns Updated history state and the next item, or null if at end
 */
export function redo<T>(state: HistoryState<T>): {
  state: HistoryState<T>;
  item: T | null;
} {
  if (state.historyIndex >= state.history.length - 1) {
    return { state, item: null };
  }
  const newIndex = Math.min(state.historyIndex + 2, state.history.length - 1);
  return {
    state: { ...state, historyIndex: newIndex },
    item: state.history[newIndex] ?? null,
  };
}

/**
 * Get the current item from history
 * @param state Current history state
 * @returns Current item or null if history is empty
 */
export function getCurrentHistoryItem<T>(state: HistoryState<T>): T | null {
  return state.history[state.historyIndex] ?? null;
}

/**
 * Clear all history
 * @returns Reset history state
 */
export function clearHistory<T>(): HistoryState<T> {
  return {
    history: [],
    historyIndex: 0,
  };
}
