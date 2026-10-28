import { SAVE } from './config.js';
import { serialize, deserialize } from './state.js';

// Storage can be missing or throw (private windows, blocked site data), so every call is guarded.

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE.key);
    return raw ? deserialize(raw) : null;
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE.key, serialize(state));
  } catch {
    // Progress just won't persist this session.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE.key);
  } catch {
    // Nothing to clear.
  }
}
