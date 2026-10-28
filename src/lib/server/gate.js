import { countWords } from '#lib/materials.js';

// Starting cutoff from my Methods, "a recall under 10 words is nearly empty".
// I set the final one from the pilot data
export const MIN_WORDS = 10;

// The word the hidden instructions ask an AI to use
const CANARY = /erstwhile/i;

// Submit-time gate: only the mechanical clear fails. Everything else (honesty
// item, typing log, leaving the page) is logged here and filtered in R.
export function clearFail(recall) {
	if (countWords(recall) < MIN_WORDS) return 'near_empty';
	if (CANARY.test(recall)) return 'canary';
	return null;
}

// Spacing fixes only: trim, collapse runs of spaces, keep paragraph breaks.
// I haven't decided on spelling correction yet
export function cleanSpacing(recall) {
	return recall
		.replace(/\r\n?/g, '\n')
		.split(/\n\s*\n/)
		.map((para) => para.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n\n');
}
