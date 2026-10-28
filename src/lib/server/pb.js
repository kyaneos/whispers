import PocketBase from 'pocketbase';
import { env as devEnv } from '$env/dynamic/private';

export const CHAINS = 'whispers_chains';
export const RESPONSES = 'whispers_responses';

// Every database call goes through these server routes, logged in as the one
// whispers_app account. Its rules reach only the whispers_ collections, so the
// lab's other data stays out of reach, and participants never hold a PB login.
// TEL-116: secrets are runtime-only on Cloudflare, so read platform.env first
// and fall back to .env for local dev.
let cached = null;

export async function getPb(platform) {
	const env = platform?.env?.PB_URL ? platform.env : devEnv;
	if (cached?.authStore.isValid && cached.baseURL === env.PB_URL) return cached;

	const pb = new PocketBase(env.PB_URL);
	pb.autoCancellation(false);
	await pb.collection('whispers_app').authWithPassword(env.PB_APP_EMAIL, env.PB_APP_PASSWORD);
	cached = pb;
	return pb;
}

// Load a participant's row, checking the token we gave them at /api/start
export async function getResponse(pb, id, token) {
	const row = await pb.collection(RESPONSES).getOne(id);
	if (!token || row.token !== token) throw new Error('bad token');
	return row;
}
