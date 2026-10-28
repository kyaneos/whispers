import { json, error } from '@sveltejs/kit';
import { getPb, getResponse, CHAINS, RESPONSES } from '#lib/server/pb.js';
import { readJson, session, sized, LIMITS } from '#lib/server/input.js';
import { clearFail, cleanSpacing } from '#lib/server/gate.js';

const GENERATIONS = 4;

// Recall submit. Pass: the cleaned recall becomes the chain's next text and the
// chain moves to the next generation. Clear fail: the row is excluded and the
// same generation reopens. The participant is never told which happened.
export async function POST({ request }) {
	const body = await readJson(request);
	const { id, token } = session(body);
	if (typeof body.recall !== 'string') error(400, 'bad request');
	if (body.recall.length > LIMITS.recall) error(413, 'recall too long');
	const keystroke_log = sized(body.keystroke_log, LIMITS.log, 'keystroke log');

	const pb = await getPb();
	const row = await getResponse(pb, id, token);
	if (row.status !== 'claimed') error(409, `cannot submit from status ${row.status}`);

	const chain = await pb.collection(CHAINS).getOne(row.chain_ref);
	if (chain.generation !== row.generation || chain.claimed_by !== row.id) {
		error(409, 'chain moved on'); // should never happen while the slot is claimed
	}

	const recall_raw = body.recall;
	const fail = clearFail(recall_raw);

	if (fail) {
		await pb.collection(RESPONSES).update(row.id, {
			recall_raw,
			keystroke_log,
			status: 'excluded',
			exclude_reason: fail
		});
		await pb
			.collection(CHAINS)
			.update(chain.id, { status: 'open', claimed_by: '', claimed_at: '' });
	} else {
		const recall_passed = cleanSpacing(recall_raw);
		await pb.collection(RESPONSES).update(row.id, {
			recall_raw,
			recall_passed,
			keystroke_log,
			status: 'passed'
		});
		const next = chain.generation + 1;
		await pb.collection(CHAINS).update(chain.id, {
			current_text: recall_passed,
			generation: Math.min(next, GENERATIONS),
			status: next > GENERATIONS ? 'done' : 'open',
			claimed_by: '',
			claimed_at: ''
		});
	}
	return json({ ok: true });
}
