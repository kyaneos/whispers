// Saves every row of whispers_responses to one JSON file for the analysis.
// JSON keeps the nested fields (trials, keystroke log, interaction data) intact.
// The file holds participant data, so exports/ is gitignored.
//   npm run export                     saves to exports/whispers_responses.json
//   npm run export -- <file path>      saves there instead, e.g. a study's private data folder
import PocketBase from 'pocketbase';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const OUT = process.argv[2] || 'exports/whispers_responses.json';

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

// the token is only for the participant's browser, so it stays out of the file
const rows = await pb.collection('whispers_responses').getFullList({ sort: 'created' });
for (const row of rows) {
	delete row.token;
	delete row.collectionId;
	delete row.collectionName;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`saved ${rows.length} rows to ${OUT}`);
