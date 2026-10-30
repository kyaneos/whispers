// Decides a held recall after reading it, and moves its chain on.
//   npm run release <row id>            show the recall, the text it read, and why it was held
//   npm run release <row id> pass       pass it on to the next generation
//   npm run release <row id> exclude    exclude it, so the same generation runs again
import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { CHAINS, RESPONSES, advance, reopen } from '../src/lib/server/chain.js';

const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.startsWith('#'))
		.map((line) => [
			line.slice(0, line.indexOf('=')).trim(),
			line.slice(line.indexOf('=') + 1).trim()
		])
);

const [id, decision] = process.argv.slice(2);
if (!id || (decision && decision !== 'pass' && decision !== 'exclude')) {
	console.error('usage: npm run release <row id> [pass | exclude]');
	process.exit(1);
}

const pb = new PocketBase(env.PB_URL);
await pb.collection('whispers_app').authWithPassword(env.PB_APP_EMAIL, env.PB_APP_PASSWORD);

const row = await pb.collection(RESPONSES).getOne(id);
if (row.status !== 'held') {
	console.error(`row ${id} is ${row.status}, not held`);
	process.exit(1);
}

// no decision yet: show what there is to read
if (!decision) {
	console.log(`chain ${row.chain}, generation ${row.generation}, held for: ${row.flags.join(', ')}\n`);
	console.log(`THE TEXT THEY READ\n${row.input_text}\n`);
	console.log(`THEIR RECALL\n${row.recall_raw}`);
	process.exit(0);
}

const chain = await pb.collection(CHAINS).getOne(row.chain_ref);
if (decision === 'pass') {
	await pb.collection(RESPONSES).update(row.id, { status: 'passed' });
	await advance(pb, chain, row.recall_passed);
	console.log(`passed: chain ${row.chain} moves on from generation ${row.generation}`);
} else {
	await pb.collection(RESPONSES).update(row.id, { status: 'excluded', exclude_reason: 'review' });
	await reopen(pb, chain);
	console.log(`excluded: chain ${row.chain}, generation ${row.generation} runs again`);
}
