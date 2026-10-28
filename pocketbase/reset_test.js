// Puts the test chains back to the start and deletes the test rows, so the
// study can be run through again. Real chains and real rows are never touched.
//   npm run reset-test
import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.startsWith('#'))
		.map((line) => [
			line.slice(0, line.indexOf('=')).trim(),
			line.slice(line.indexOf('=') + 1).trim()
		])
);

const pb = new PocketBase(env.PB_URL);
await pb.collection('whispers_app').authWithPassword(env.PB_APP_EMAIL, env.PB_APP_PASSWORD);

const rows = await pb.collection('whispers_responses').getFullList({ filter: 'test = true' });
for (const row of rows) await pb.collection('whispers_responses').delete(row.id);
console.log(`deleted ${rows.length} test rows`);

const chains = await pb.collection('whispers_chains').getFullList({ filter: 'test = true' });
for (const chain of chains) {
	await pb.collection('whispers_chains').update(chain.id, {
		generation: 1,
		status: 'open',
		claimed_by: '',
		claimed_at: '',
		current_text: ''
	});
}
console.log(`reset ${chains.length} test chains to generation 1`);
