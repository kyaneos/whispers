// The chain moves that more than one place makes: the API routes and the
// release script. The PocketBase client is passed in, so nothing here needs
// SvelteKit and the script can import it too.

export const CHAINS = 'whispers_chains';
export const RESPONSES = 'whispers_responses';
const GENERATIONS = 4;

// Frees the slot, so the same generation runs again with someone new
export function reopen(pb, chain) {
	return pb.collection(CHAINS).update(chain.id, { status: 'open', claimed_by: '', claimed_at: '' });
}

// The recall becomes the next generation's text. After generation 4 the chain is done
export function advance(pb, chain, text) {
	const next = chain.generation + 1;
	return pb.collection(CHAINS).update(chain.id, {
		current_text: text,
		generation: Math.min(next, GENERATIONS),
		status: next > GENERATIONS ? 'done' : 'open',
		claimed_by: '',
		claimed_at: ''
	});
}

// Someone left while holding a slot: the row keeps what they filled in, and the slot reopens
export async function abandon(pb, row) {
	await pb.collection(RESPONSES).update(row.id, { status: 'abandoned' });
	const chain = await pb.collection(CHAINS).getOne(row.chain_ref);
	if (chain.claimed_by === row.id) await reopen(pb, chain);
}
