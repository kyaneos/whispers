// Creates chain records. Run from the repo root with the .env filled in:
//   npm run seed -- --real 1 --test 2
// makes real chain 1 and test chains 1 and 2. Existing chains are skipped, so
// running it again with a bigger number only adds the new ones.
import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { orderForChain } from '../src/lib/materials.js';

const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.startsWith('#'))
		.map((line) => [
			line.slice(0, line.indexOf('=')).trim(),
			line.slice(line.indexOf('=') + 1).trim()
		])
);

const arg = (name) => Number(process.argv[process.argv.indexOf(`--${name}`) + 1] || 0);
const counts = { real: arg('real'), test: arg('test') };

for (const key of ['PB_URL', 'PB_APP_EMAIL', 'PB_APP_PASSWORD']) {
	if (!env[key]) {
		console.error(`${key} is missing or empty in .env`);
		process.exit(1);
	}
}

const pb = new PocketBase(env.PB_URL);
try {
	await pb.collection('whispers_app').authWithPassword(env.PB_APP_EMAIL, env.PB_APP_PASSWORD);
} catch (err) {
	console.error(`whispers_app login failed (${err.status}): ${err.message}`);
	process.exit(1);
}

for (const [kind, n] of Object.entries(counts)) {
	const test = kind === 'test';
	for (let chain = 1; chain <= n; chain++) {
		const found = await pb
			.collection('whispers_chains')
			.getList(1, 1, { filter: pb.filter('chain = {:chain} && test = {:test}', { chain, test }) });
		if (found.totalItems) continue;
		await pb.collection('whispers_chains').create({
			chain,
			test,
			order: orderForChain(chain),
			generation: 1,
			status: 'open',
			current_text: ''
		});
		console.log(`created ${kind} chain ${chain}, order ${orderForChain(chain)}`);
	}
}
