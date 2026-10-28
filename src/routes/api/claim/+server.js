import { json, error } from '@sveltejs/kit';
import { getPb, getResponse, CHAINS, RESPONSES } from '$lib/server/pb';
import { g1Text } from '$lib/materials';

// Claims the lowest-numbered open chain. The database enforces one active row
// per (chain, generation) slot with a unique index, so if two people claim at
// once, one update fails and that person moves on to the next chain.
export async function POST({ request, platform }) {
	const { id, token } = await request.json();
	const pb = await getPb(platform);
	const row = await getResponse(pb, id, token).catch(() => error(403));
	if (row.status !== 'started') error(409, `cannot claim from status ${row.status}`);

	const chains = await pb.collection(CHAINS).getFullList({
		filter: pb.filter('test = {:test} && status = "open"', { test: row.test }),
		sort: 'chain'
	});

	for (const c of chains) {
		// G1 reads the four paragraphs in the chain's order; G2+ read the last recall
		const input_text = c.generation === 1 ? g1Text(c.order) : c.current_text;
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
