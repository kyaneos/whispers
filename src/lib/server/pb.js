import PocketBase from 'pocketbase';
import { error } from '@sveltejs/kit';
import { PB_URL, PB_APP_EMAIL, PB_APP_PASSWORD, STUDY_KEY } from '$app/env/private';

export const CHAINS = 'whispers_chains';
export const RESPONSES = 'whispers_responses';

// Every database call goes through the server routes, logged in as the one
// whispers_app account. Its rules reach only the whispers_ collections, so the
// lab's other data stays out of reach, and participants never hold a PB login.
// The settings are defined in src/env.js. The login is reused until it expires.
let cached = null;

export async function getPb() {
	if (cached?.authStore.isValid) return cached;

	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);
	await pb.collection('whispers_app').authWithPassword(PB_APP_EMAIL, PB_APP_PASSWORD);
	cached = pb;
	return pb;
}

// The study key is part of the link (?k=...). Without it nobody can start a
// session, so a leaked or guessed URL on its own does nothing. If the key isn't
// configured the study is closed, never open.
export function checkStudyKey(key) {
	if (!STUDY_KEY || key !== STUDY_KEY) error(403, 'invalid link');
}

// Load a participant's row, checking the token handed out at /api/start
export async function getResponse(pb, id, token) {
	const row = await pb.collection(RESPONSES).getOne(id).catch(() => error(403));
	if (row.token !== token) error(403);
	return row;
}
