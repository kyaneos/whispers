import { get } from 'svelte/store';
import { SESSION } from './stores';

// where this browser remembers its row, to spot a reload
const KEY = 'whispers_session';

// Saves run one at a time, because each one adds to the same row
let queue = Promise.resolve();
const enqueue = (job) => (queue = queue.then(job, job));

// POST to one of the server routes. A failed request carries its status code,
// so the page can tell a bad link (403) from a network problem
async function post(path, body) {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	if (!res.ok) {
		const err = new Error(`${path} failed: ${res.status}`);
		err.status = res.status;
		throw err;
	}
	return res.json();
}

// the row id and token every call after start() sends
const auth = () => {
	const { id, token } = get(SESSION);
	return { id, token };
};

// Find or create this browser's row. ?k= is the study key (the server refuses
// to start without it), ?pid= sets the participant id, ?test=1 routes to the
// test chains.
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
		key: params.get('k') || '',
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

export const claim = () => enqueue(() => post('/api/claim', auth()));
export const saveTrial = (trial) => enqueue(() => post('/api/save', { ...auth(), trial }));
export const submitRecall = (recall, keystroke_log) =>
	enqueue(() => post('/api/submit', { ...auth(), recall, keystroke_log }));
