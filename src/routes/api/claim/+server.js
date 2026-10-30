import { json, error } from '@sveltejs/kit';
import { getPb, getResponse } from '#lib/server/pb.js';
import { CHAINS, RESPONSES, abandon } from '#lib/server/chain.js';
import { readJson, session } from '#lib/server/input.js';
import { originalText } from '#lib/materials.js';

// A slot claimed this long ago belongs to someone who left and never came back
const STALE_MS = 60 * 60 * 1000; // 1 hour

// Claims the lowest-numbered open chain. The database enforces one active row
// per (chain, generation) slot with a unique index, so if two people claim at
// once, one update fails and that person moves on to the next chain.
export async function POST({ request }) {
	const { id, token } = session(await readJson(request));
	const pb = await getPb();
	const row = await getResponse(pb, id, token);
	if (row.status !== 'started') error(409, `cannot claim from status ${row.status}`);

	// free stale slots first, so they can be claimed below
	const cutoff = new Date(Date.now() - STALE_MS).toISOString().replace('T', ' ');
	const stale = await pb.collection(CHAINS).getFullList({
		filter: pb.filter('test = {:test} && status = "claimed" && claimed_at < {:cutoff}', {
			test: row.test,
			cutoff
		})
	});
	for (const c of stale) {
		await abandon(pb, await pb.collection(RESPONSES).getOne(c.claimed_by));
	}

	const chains = await pb.collection(CHAINS).getFullList({
		filter: pb.filter('test = {:test} && status = "open"', { test: row.test }),
		sort: 'chain'
	});

	for (const c of chains) {
		// generation 1 reads the original text; generations 2 to 4 read the recall before them
		const input_text = c.generation === 1 ? originalText(c.order) : c.current_text;
		try {
			await pb.collection(RESPONSES).update(row.id, {
				status: 'claimed',
				chain_ref: c.id,
				chain: c.chain,
				generation: c.generation,
				order: c.order,
				slot: `${c.id}-${c.generation}`,
				input_text
			});
		} catch {
			continue; // someone else took this slot first
		}
		await pb.collection(CHAINS).update(c.id, {
			status: 'claimed',
			claimed_by: row.id,
			claimed_at: new Date().toISOString()
		});
		return json({ chain: c.chain, generation: c.generation, order: c.order, input_text });
	}

	// no open slot: never open a new chain here
	await pb.collection(RESPONSES).update(row.id, { status: 'no_slot' });
	return json({ chain: null });
}
