// Saves every row of whispers_responses to one JSON file for the analysis.
// JSON keeps the nested fields (trials, keystroke log, interaction data) intact.
// The file holds participant data, so exports/ is gitignored.
//   npm run export
import PocketBase from 'pocketbase';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'exports/whispers_responses.json';

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

mkdirSync('exports', { recursive: true });
writeFileSync(OUT, JSON.stringify(rows, null, 2));
console.log(`saved ${rows.length} rows to ${OUT}`);
