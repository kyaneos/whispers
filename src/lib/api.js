import { get } from 'svelte/store';
import { SESSION } from './stores';

const KEY = 'whispers_session';

async function post(path, body) {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
	return res.json();
}

// Saves run one at a time, because each one adds to the same row
let queue = Promise.resolve();
const enqueue = (job) => (queue = queue.then(job, job));

// Find or create this browser's row. ?pid= sets the participant id, ?test=1
// routes to the test chains.
export async function start() {
	const params = new URLSearchParams(window.location.search);
	let saved = null;
	try {
		saved = JSON.parse(localStorage.getItem(KEY));
	} catch {
		// private window or blocked storage: start fresh
	}
	const session = await post('/api/start', {
		id: saved?.id,
		token: saved?.token,
		pid: params.get('pid') || '',
		test: params.get('test') === '1'
	});
	try {
		localStorage.setItem(KEY, JSON.stringify({ id: session.id, token: session.token }));
	} catch {
		// the study still runs, it just can't spot a reload
	}
	SESSION.set(session);
	return session;
}

const auth = () => {
	const { id, token } = get(SESSION);
	return { id, token };
};

export const claim = () => enqueue(() => post('/api/claim', auth()));
export const saveTrial = (trial) => enqueue(() => post('/api/save', { ...auth(), trial }));
export const submitRecall = (recall, keystroke_log) =>
	enqueue(() => post('/api/submit', { ...auth(), recall, keystroke_log }));
