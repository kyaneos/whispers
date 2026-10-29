import { error } from '@sveltejs/kit';

// Every route reads its request through here, so nothing oversized or
// malformed reaches the database

// Size limits. Recall is in characters (the schema's max for a text field); the
// rest are in bytes of JSON
export const LIMITS = {
	body: 256 * 1024, // the whole request
	recall: 20000, // the recall text
	trial: 64 * 1024, // one jsPsych trial
	log: 64 * 1024, // the keystroke log or the interaction data
	trials: 100 // how many trials one row may hold
};

// The shapes of a participant's row id and token
export const ID = /^[a-z0-9]{15}$/; // a PocketBase record id
export const TOKEN = /^[0-9a-f-]{36}$/; // the random id handed out by /api/start

// Stops oversized requests and anything that isn't a JSON object
export async function readJson(request) {
	const text = await request.text();
	if (text.length > LIMITS.body) error(413, 'request too large');
	let body;
	try {
		body = JSON.parse(text);
	} catch {
		error(400, 'bad request');
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) error(400, 'bad request');
	return body;
}

// Stops requests whose id or token isn't the shape /api/start hands out
export function session(body) {
	const { id, token } = body;
	if (typeof id !== 'string' || !ID.test(id) || typeof token !== 'string' || !TOKEN.test(token)) {
		error(403);
	}
	return { id, token };
}

// Stops invisible control characters (keeps tabs and line breaks) and cuts a
// text field to the schema's length
export const text = (value, max) =>
	// eslint-disable-next-line no-control-regex
	String(value ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, max);

// Stops a JSON field bigger than `max` bytes
export function sized(value, max, what) {
	if (value === undefined || value === null) return null;
	if (JSON.stringify(value).length > max) error(413, `${what} too large`);
	return value;
}
