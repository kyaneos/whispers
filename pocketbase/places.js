// How many places to add on Prolific right now, so nobody reaches the no-slot screen.
//   npm run places
// A place is safe to add only if a real slot will be waiting: an open chain, or a new
// chain still allowed under the cap. People who started in the last hour but haven't
// reached the text yet will take some of those, so they are subtracted. Held chains
// wait for `npm run release`, so they don't count until they are released.
import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { CHAINS, RESPONSES, MAX_CHAINS } from '../src/lib/server/chain.js';

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

const chains = await pb.collection(CHAINS).getFullList({ filter: 'test = false' });
const count = (status) => chains.filter((c) => c.status === status).length;
const open = count('open');
const room = Math.max(0, MAX_CHAINS - chains.length);

const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace('T', ' ');
const arriving = (
	await pb.collection(RESPONSES).getFullList({
		filter: pb.filter('test = false && status = "started" && created > {:hourAgo}', { hourAgo })
	})
).length;

console.log(`real chains: ${chains.length} of ${MAX_CHAINS}`);
console.log(`  open ${open}, in progress ${count('claimed')}, held ${count('held')}, done ${count('done')}`);
console.log(`new chains still allowed: ${room}`);
console.log(`started but not at the text yet: ${arriving}`);
console.log(`\nadd ${Math.max(0, open + room - arriving)} places on Prolific`);
