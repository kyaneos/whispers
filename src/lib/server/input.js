import { error } from '@sveltejs/kit';

// Every route reads its request through here, so nothing oversized or
// malformed reaches the database. Limits are in bytes of JSON.
export const LIMITS = {
	body: 256 * 1024, // the whole request
	recall: 20000, // characters, the schema's max for a text field
	trial: 64 * 1024, // one jsPsych trial
	log: 64 * 1024, // the keystroke log or the interaction data
	trials: 100 // how many trials one row may hold
};

export const ID = /^[a-z0-9]{15}$/; // a PocketBase record id
export const TOKEN = /^[0-9a-f-]{36}$/; // the uuid handed out by /api/start

// Read the body as JSON, refusing anything over the size limit
export async function readJson(request) {
	const text = await request.text();
	if (text.length > LIMITS.body) error(413, 'request too large');
	try {
		const body = JSON.parse(text);
		if (!body || typeof body !== 'object' || Array.isArray(body)) error(400, 'bad request');
		return body;
	} catch (err) {
		if (err?.status) throw err;
		error(400, 'bad request');
	}
}

// The participant's row id and token, in the shapes /api/start hands out
export function session(body) {
	const { id, token } = body;
	if (typeof id !== 'string' || !ID.test(id) || typeof token !== 'string' || !TOKEN.test(token)) {
		error(403);
	}
	return { id, token };
}

// A string field, cut to the schema's length and stripped of control characters
export const text = (value, max) =>
	Array.from(String(value ?? ''))
		.filter((ch) => {
			const c = ch.charCodeAt(0);
			return c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127);
		})
		.join('')
		.slice(0, max);

// A JSON field, refused if it would take more than `max` bytes to store
export function sized(value, max, what) {
	if (value === undefined || value === null) return null;
	if (JSON.stringify(value).length > max) error(413, `${what} too large`);
	return value;
}

// Compare two strings in constant time, so a wrong guess takes as long as a
// near miss. Used for the study key and the session token.
export function sameString(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string') return false;
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	let diff = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}
