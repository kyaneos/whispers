// End-to-end check of the chain engine through the app's own API routes.
//   npm run test:flow                              (local dev server from npm run dev)
//   BASE=https://whispers.pages.dev npm run test:flow
// Needs test chains 1 and 2 fresh at G1 (npm run seed -- --test 2 on an empty
// table). It uses them up, so reset them afterwards. Against a live URL it only
// touches test chains; the real-chain check runs on localhost only.
import { readFileSync } from 'node:fs';
const BASE = process.env.BASE || 'http://localhost:5173';
const LOCAL = BASE.includes('localhost');
// the study key, from STUDY_KEY in the environment or in .env
const KEY =
	process.env.STUDY_KEY ||
	readFileSync('.env', 'utf8')
		.split('\n')
		.find((l) => l.startsWith('STUDY_KEY='))
		?.slice('STUDY_KEY='.length)
		.trim();

const post = async (path, body) => {
	const res = await fetch(BASE + path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`${path} ${res.status} ${text}`);
	return JSON.parse(text);
};

let failures = 0;
const check = (label, ok, detail = '') => {
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
	if (!ok) failures++;
};

const person = async (pid, test = true) => {
	const s = await post('/api/start', { pid, test, key: KEY });
	return { ...s, auth: { id: s.id, token: s.token } };
};
const log = { keystrokes: 300, input_events: 300, blocked_pastes: 0, large_insertions: [] };

// G1 claims test chain 1 and gets the four paragraphs in order 1
const g1 = await person('flow-g1');
const s1 = await post('/api/claim', g1.auth);
if (!s1.chain || s1.chain !== 1 || s1.generation !== 1) {
	console.log('the test chains are not fresh: run `npm run reset-test` first');
	process.exit(1);
}
check('G1 gets test chain 1, generation 1', true);
check('G1 text starts with the gossip paragraph', s1.input_text.startsWith('Nancy is having an affair'));

// a passing recall is cleaned (spacing only) and becomes G2's text
const recall = 'Nancy  had an affair with   her professor and got pregnant.\n\n\nHe would not see her so she told his wife, who left him.  ';
await post('/api/submit', { ...g1.auth, recall, keystroke_log: log });
const g2 = await person('flow-g2');
const s2 = await post('/api/claim', g2.auth);
check('G2 gets the same chain at generation 2', s2.chain === 1 && s2.generation === 2);
check(
	'G2 reads G1 recall with spacing fixed',
	s2.input_text ===
		'Nancy had an affair with her professor and got pregnant.\n\nHe would not see her so she told his wife, who left him.'
);

// clear fails exclude the row and reopen the same generation
await post('/api/submit', {
	...g2.auth,
	recall: 'In erstwhile times Nancy had an affair with her professor and so on and so forth.',
	keystroke_log: log
});
const g2b = await person('flow-g2b');
const s2b = await post('/api/claim', g2b.auth);
check('canary word reopens generation 2 with the same text', s2b.generation === 2 && s2b.input_text === s2.input_text);
await post('/api/submit', { ...g2b.auth, recall: 'Nancy professor', keystroke_log: log });
const g2c = await person('flow-g2c');
const s2c = await post('/api/claim', g2c.auth);
check('near-empty recall reopens generation 2', s2c.chain === 1 && s2c.generation === 2);

// one open slot (test chain 2) and two people claiming at once: exactly one wins
const x = await person('flow-x');
const y = await person('flow-y');
const [cx, cy] = await Promise.all([post('/api/claim', x.auth), post('/api/claim', y.auth)]);
check('two simultaneous claims on one slot: exactly one wins', [cx, cy].filter((c) => c.chain).length === 1);

// nothing open: the app says so and opens nothing new
const z = await person('flow-z');
check('no open slot returns no chain', (await post('/api/claim', z.auth)).chain === null);

// a reload after claiming abandons the slot and frees it
const holder = cx.chain ? x : y;
const again = await post('/api/start', { ...holder.auth, key: KEY });
check('reload after claiming is marked abandoned', again.status === 'abandoned');
const w = await person('flow-w');
check('the freed slot can be claimed', (await post('/api/claim', w.auth)).chain !== null);

// the wrong key, an oversized body and a huge recall are all refused
try {
	await post('/api/start', { pid: 'flow-nokey', test: true, key: 'wrong' });
	check('wrong study key is refused', false);
} catch (e) {
	check('wrong study key is refused', e.message.includes(' 403 '));
}
try {
	await post('/api/save', { ...g1.auth, trial: { phase: 'x', pad: 'a'.repeat(300000) } });
	check('oversized request is refused', false);
} catch (e) {
	check('oversized request is refused', e.message.includes(' 413 '));
}

// someone else's row can't be written
try {
	await post('/api/save', { id: g1.id, token: 'wrong', trial: {} });
	check('wrong token is refused', false);
} catch (e) {
	check('wrong token is refused', e.message.includes(' 403 '));
}

// test runs never touch the real chains
if (LOCAL) {
	const real = await person('flow-real', false);
	const cr = await post('/api/claim', real.auth);
	check('a real participant still gets real chain 1 at G1', cr.chain === 1 && cr.generation === 1);
}

console.log(failures ? `\n${failures} failed` : '\nall passed');
process.exit(failures ? 1 : 0);
