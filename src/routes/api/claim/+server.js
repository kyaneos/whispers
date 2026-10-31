import { json, error } from '@sveltejs/kit';
import { getPb, getResponse } from '#lib/server/pb.js';
import { CHAINS, RESPONSES, abandon } from '#lib/server/chain.js';
import { readJson, session } from '#lib/server/input.js';
import { originalText, orderForChain } from '#lib/materials.js';

// A slot claimed this long ago belongs to someone who left and never came back
const STALE_MS = 60 * 60 * 1000; // 1 hour

// New chains open only while there is room and time. Test chains never count
// toward the cap. After the cutoff, SONA stays open only to finish running chains
const MAX_CHAINS = 32;
const NEW_CHAINS_UNTIL = new Date('2026-11-21T00:00:00-08:00'); // the end of Fri Nov 20, San Diego time

// Puts the participant in this chain's open slot. Returns what they read, or
// null if someone else got the slot first: the database allows one active row
// per (chain, generation) slot, so of two people claiming at once, one update fails
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

// Opens the next chain number, or returns null if there is no room or time left.
// Chain numbers are unique, so if two people open the same number at once the
// database refuses the second, and that person tries the next number instead
async function openChain(pb, test) {
	if (Date.now() >= NEW_CHAINS_UNTIL.getTime()) return null;
	for (let tries = 0; tries < 10; tries++) {
		const last = await pb.collection(CHAINS).getList(1, 1, {
			filter: pb.filter('test = {:test}', { test }),
			sort: '-chain'
		});
		const chain = (last.items[0]?.chain || 0) + 1;
		if (!test && chain > MAX_CHAINS) return null; // chains are numbered 1, 2, 3... so this is the count
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
			// someone else just opened this number: look again
		}
	}
	return null;
}

// Gives the participant a slot. Finishing chains comes first: the open slot at
// the highest generation, ties to the lowest chain number. Claimed and held
// chains are never offered. With nothing open, a new chain opens if allowed.
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

	// When several people arrive together, someone can lose a slot, or even a
	// chain they just opened, to someone else. They look again, up to 10 times
	for (let round = 0; round < 10; round++) {
		const open = await pb.collection(CHAINS).getFullList({
			filter: pb.filter('test = {:test} && status = "open"', { test: row.test }),
			sort: '-generation,chain'
		});
		for (const c of open) {
			const slot = await takeSlot(pb, row, c);
			if (slot) return json(slot);
		}

		const fresh = await openChain(pb, row.test);
		if (!fresh) break; // no room or time for a new chain
		const slot = await takeSlot(pb, row, fresh);
		if (slot) return json(slot);
	}

	await pb.collection(RESPONSES).update(row.id, { status: 'no_slot' });
	return json({ chain: null });
}
