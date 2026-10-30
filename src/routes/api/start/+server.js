import { json } from '@sveltejs/kit';
import { getPb, getResponse, checkStudyKey } from '#lib/server/pb.js';
import { RESPONSES, abandon } from '#lib/server/chain.js';
import { readJson, text, ID, TOKEN } from '#lib/server/input.js';

// Creates the participant's row, or finds it again after a reload.
// Coming back while holding a slot (a reload, a closed tab, or the 10-minute
// timeout) counts as abandoning it, which frees the slot, since the text has
// already been seen and the timeline can't resume mid-task.
export async function POST({ request }) {
	const { id, token, pid, test, key } = await readJson(request);
	checkStudyKey(key);
	const pb = await getPb();

	if (typeof id === 'string' && ID.test(id) && typeof token === 'string' && TOKEN.test(token)) {
		try {
			let row = await getResponse(pb, id, token);
			// a saved row from the other kind of link (test vs real) never carries over
			if (row.test === (test === true)) {
				// not yet holding a slot (or none was open last time): start over cleanly
				if (row.status === 'started' || row.status === 'no_slot') {
					row = await pb
						.collection(RESPONSES)
						.update(row.id, { status: 'started', trials: [], instructions_attempts: 0 });
				}
				if (row.status === 'claimed' || row.status === 'submitted') {
					await abandon(pb, row);
					row.status = 'abandoned';
				}
				return json({ id: row.id, token, status: row.status, test: row.test });
			}
		} catch {
			// unknown or stale id: fall through and start fresh
		}
	}

	const row = await pb.collection(RESPONSES).create({
		pid: text(pid, 100),
		test: test === true,
		status: 'started',
		token: crypto.randomUUID(),
		user_agent: text(request.headers.get('user-agent'), 300)
	});
	return json({ id: row.id, token: row.token, status: row.status, test: row.test });
}
