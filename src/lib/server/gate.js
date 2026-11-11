import { countWords } from '#lib/materials.js';

// Starting cutoffs, to be set from the pilot data. A recall under 10 words that
// is also under a quarter of the words it read is nearly empty, so a short
// recall of an already short text isn't
const MIN_WORDS = 10;
const MIN_WORD_SHARE = 0.25;
// typing fewer keys than half the recall's length means the text went in some other way
const MIN_TYPED_SHARE = 0.5;
// sharing fewer than 15% of its words with the text it read holds the recall for review
const MIN_OVERLAP = 0.15;

// The word the hidden instructions ask an AI to use
const CANARY = /erstwhile/i;

// Participants are told to type. Any large insertion (logged by the recall
// screen) or far fewer keys than characters means the text went in another way
function typed(recall, log) {
	const inserted = (log?.large_insertions?.length || 0) > 0;
	return !inserted && (log?.keystrokes || 0) >= MIN_TYPED_SHARE * recall.length;
}

// The words of 4+ letters in a text, lowercased (this skips "the", "and", "was")
const words = (text) => new Set(text.toLowerCase().match(/[a-z]{4,}/g) || []);

// Clear fails at submit. These exclude the recall and rerun the generation
export function clearFail(recall, keystroke_log) {
	if (CANARY.test(recall)) return 'canary';
	if (!typed(recall, keystroke_log)) return 'not_typed';
	return null;
}

// A judgment call: the recall is nearly empty, so the chain waits for a person to look at it
export function nearEmpty(recall, inputText) {
	const n = countWords(recall);
	return n < MIN_WORDS && n < MIN_WORD_SHARE * countWords(inputText);
}

// A judgment call: too few of the recall's words appear in the
// text it read, so the chain waits for a person to look at it
export function offTopic(recall, inputText) {
	const mine = words(recall);
	const source = words(inputText);
	const shared = [...mine].filter((w) => source.has(w)).length;
	return shared / mine.size < MIN_OVERLAP;
}

// Spacing fixes only: trim, collapse runs of spaces, keep paragraph breaks.
export function cleanSpacing(recall) {
	return recall
		.replace(/\r\n?/g, '\n')
		.split(/\n\s*\n/)
		.map((para) => para.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join('\n\n');
}
