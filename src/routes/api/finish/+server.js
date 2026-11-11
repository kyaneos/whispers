import { json, error } from '@sveltejs/kit';
import { getPb, getResponse } from '#lib/server/pb.js';
import { CHAINS, RESPONSES, reopen, advance } from '#lib/server/chain.js';
import { readJson, session } from '#lib/server/input.js';
import { announce } from '#lib/server/slack.js';

// Runs once the final questions are saved, and decides the submitted recall.
// Outside help excludes it and the generation reopens. A flag holds the chain
// until someone reviews it (npm run release). Anything else is passed on.
export async function POST({ request }) {
	const { id, token } = session(await readJson(request));
	const pb = await getPb();
	const row = await getResponse(pb, id, token);
	if (row.status !== 'submitted') error(409, `cannot finish from status ${row.status}`);

	const chain = await pb.collection(CHAINS).getOne(row.chain_ref);
	if (chain.claimed_by !== row.id) error(409, 'chain moved on');

	// a failed "select Rarely" item joins the flags from submit
	const flags = [...(row.flags || [])];
	if (!row.instructed_passed) flags.push('instructed_response');

	if (row.outside_help === 'Yes') {
		await pb.collection(RESPONSES).update(row.id, { status: 'excluded', exclude_reason: 'outside_help' });
		await reopen(pb, chain);
		await announce(`${row.test ? '[test] ' : ''}Chain ${row.chain}, generation ${row.generation} excluded (outside_help), so it runs again`);
	} else if (flags.length) {
		await pb.collection(RESPONSES).update(row.id, { status: 'held', flags });
		await pb.collection(CHAINS).update(chain.id, { status: 'held' });
		await announce(
			`${row.test ? '[test] ' : ''}Chain ${row.chain}, generation ${row.generation} is held (${flags.join(', ')}). ` +
				`Read it, then: npm run release ${row.id} pass  or  npm run release ${row.id} exclude`
		);
	} else {
		await pb.collection(RESPONSES).update(row.id, { status: 'passed' });
		await advance(pb, chain, row.recall_passed);
	}
	return json({ ok: true });
}
