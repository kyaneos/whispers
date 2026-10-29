import { writable } from 'svelte/store';

// The participant's row id, token and test flag, from /api/start
export const SESSION = writable(null);

// The claimed slot: chain, generation, order and the text to read
export const SLOT = writable(null);

// The phase tag of the screen on show, for the progress bar
export const PHASE = writable(null);
