import { json, error } from '@sveltejs/kit';
import { getPb, getResponse } from '#lib/server/pb.js';
import { CHAINS, RESPONSES, abandon } from '#lib/server/chain.js';
import { readJson, session } from '#lib/server/input.js';
import { originalText, orderForChain } from '#lib/materials.js';

// A slot held this long belongs to someone who left and never came back
const STALE_MS = 60 * 60 * 1000; // 1 hour

// New chains open only up to the cap and the cutoff. Test chains don't count toward the cap
const MAX_CHAINS = 32;
const NEW_CHAINS_UNTIL = new Date('2026-11-21T00:00:00-08:00'); // the end of Fri Nov 20, San Diego time

// Puts the participant in this chain's open slot and returns what they'll read.
// Returns null if someone else got there first (the database allows one person per slot)
async function takeSlot(pb, row, c) {
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
		return null;
	}
	await pb.collection(CHAINS).update(c.id, {
		status: 'claimed',
		claimed_by: row.id,
		claimed_at: new Date().toISOString()
	});
	return { chain: c.chain, generation: c.generation, order: c.order, input_text };
}

// The next chain number, or null when past the cutoff or at the cap
async function nextChainNumber(pb, test) {
	if (Date.now() >= NEW_CHAINS_UNTIL.getTime()) return null;
	const last = await pb.collection(CHAINS).getList(1, 1, {
		filter: pb.filter('test = {:test}', { test }),
		sort: '-chain'
	});
	const chain = (last.items[0]?.chain || 0) + 1;
	if (!test && chain > MAX_CHAINS) return null;
	return chain;
}

// Creates the chain. Returns null if the database refuses, because someone
// else just took that number or it's busy
async function openChain(pb, test, chain) {
	try {
		return await pb.collection(CHAINS).create({
			chain,
			test,
			order: orderForChain(chain),
			generation: 1,
			status: 'open',
			current_text: ''
		});
	} catch {
		return null;
	}
}

// Gives the participant a slot. The open slot at the highest generation goes
// first, so chains finish, with ties to the lowest chain number. Held and
// claimed chains are skipped. If nothing is open, a new chain opens.
export async function POST({ request }) {
	const { id, token } = session(await readJson(request));
	const pb = await getPb();
	const row = await getResponse(pb, id, token);
	if (row.status !== 'started') error(409, `cannot claim from status ${row.status}`);

	// free stale slots first, so they can be given out below
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

	// When several people arrive at once, someone can lose a slot or a new chain
	// to someone else. They wait a second and try again, up to 8 times
	for (let round = 0; round < 8; round++) {
		const open = await pb.collection(CHAINS).getFullList({
			filter: pb.filter('test = {:test} && status = "open"', { test: row.test }),
			sort: '-generation,chain'
		});
		for (const c of open) {
			const slot = await takeSlot(pb, row, c);
			if (slot) return json(slot);
		}

		const number = await nextChainNumber(pb, row.test);
		if (!number) break; // past the cutoff or at the cap
		const fresh = await openChain(pb, row.test, number);
		const slot = fresh && (await takeSlot(pb, row, fresh));
		if (slot) return json(slot);
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}

	await pb.collection(RESPONSES).update(row.id, { status: 'no_slot' });
	return json({ chain: null });
}
