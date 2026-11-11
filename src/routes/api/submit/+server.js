import { json, error } from '@sveltejs/kit';
import { getPb, getResponse } from '#lib/server/pb.js';
import { CHAINS, RESPONSES, reopen } from '#lib/server/chain.js';
import { readJson, session, sized, LIMITS } from '#lib/server/input.js';
import { clearFail, nearEmpty, offTopic, cleanSpacing } from '#lib/server/gate.js';
import { announce } from '#lib/server/slack.js';

// Recall submit. A clear fail excludes the row and the same generation reopens.
// Anything else is saved as submitted, and the chain stays claimed until the
// final questions come in (/api/finish). The participant is never told which happened.
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
	const fail = clearFail(recall_raw, keystroke_log);

	if (fail) {
		await pb.collection(RESPONSES).update(row.id, {
			recall_raw,
			keystroke_log,
			status: 'excluded',
			exclude_reason: fail
		});
		await reopen(pb, chain);
		await announce(`${row.test ? '[test] ' : ''}Chain ${row.chain}, generation ${row.generation} excluded (${fail}), so it runs again`);
	} else {
		const flags = [];
		if (nearEmpty(recall_raw, row.input_text)) flags.push('near_empty');
		if (offTopic(recall_raw, row.input_text)) flags.push('off_topic');
		await pb.collection(RESPONSES).update(row.id, {
			recall_raw,
			recall_passed: cleanSpacing(recall_raw),
			keystroke_log,
			status: 'submitted',
			flags
		});
	}
	return json({ ok: true });
}
