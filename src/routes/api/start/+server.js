import { json } from '@sveltejs/kit';
import { getPb, getResponse, CHAINS, RESPONSES } from '$lib/server/pb';

// Creates the participant's row, or finds it again after a reload.
// A reload after claiming a slot counts as abandoning it, which frees the slot,
// since the text has already been seen and the timeline can't resume mid-task.
export async function POST({ request, platform }) {
	const { id, token, pid, test } = await request.json();
	const pb = await getPb(platform);

	if (id && token) {
		try {
			let row = await getResponse(pb, id, token);
			// not yet holding a slot (or none was open last time): start over cleanly
			if (row.status === 'started' || row.status === 'no_slot') {
				row = await pb
					.collection(RESPONSES)
					.update(row.id, { status: 'started', trials: [], instructions_attempts: 0 });
			}
			if (row.status === 'claimed') {
				row = await pb.collection(RESPONSES).update(row.id, { status: 'abandoned' });
				const chain = await pb.collection(CHAINS).getOne(row.chain_ref);
				if (chain.claimed_by === row.id) {
					await pb
						.collection(CHAINS)
						.update(chain.id, { status: 'open', claimed_by: '', claimed_at: '' });
				}
			}
			return json({ id: row.id, token, status: row.status, test: row.test });
		} catch {
			// unknown or stale id: fall through and start fresh
		}
	}

	const row = await pb.collection(RESPONSES).create({
		pid: String(pid || '').slice(0, 100),
		test: !!test,
		status: 'started',
		token: crypto.randomUUID(),
		user_agent: request.headers.get('user-agent')?.slice(0, 300) || ''
	});
	return json({ id: row.id, token: row.token, status: row.status, test: row.test });
}
