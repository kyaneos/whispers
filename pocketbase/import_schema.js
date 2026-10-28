// Imports collections.json into the PocketBase in .env, as a merge: only the
// collections in the file are sent, and nothing else on the instance is touched
// or deleted. Prints PocketBase's exact error if it refuses.
//   npm run import-schema
// Needs a superuser login in .env (PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD).
// Remove those two lines again once the import is done.
import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split('\n')
		.filter((line) => line.includes('=') && !line.startsWith('#'))
		.map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()])
);

for (const key of ['PB_URL', 'PB_SUPERUSER_EMAIL', 'PB_SUPERUSER_PASSWORD']) {
	if (!env[key]) {
		console.error(`${key} is missing or empty in .env`);
		process.exit(1);
	}
}

const pb = new PocketBase(env.PB_URL);
try {
	await pb.collection('_superusers').authWithPassword(env.PB_SUPERUSER_EMAIL, env.PB_SUPERUSER_PASSWORD);
} catch (err) {
	console.error(`superuser login failed (${err.status}): ${err.message}`);
	process.exit(1);
}

const collections = JSON.parse(readFileSync('pocketbase/collections.json', 'utf8'));
try {
	await pb.collections.import(collections, false); // false = never delete missing collections
	console.log('imported:', collections.map((c) => c.name).join(', '));
} catch (err) {
	console.error('import refused:', JSON.stringify(err.response, null, 2));
	process.exit(1);
}
