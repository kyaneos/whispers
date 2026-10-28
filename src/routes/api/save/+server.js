import { json, error } from '@sveltejs/kit';
import { getPb, getResponse, RESPONSES } from '#lib/server/pb.js';
import { readJson, session, sized, text, LIMITS } from '#lib/server/input.js';

// One generic save per trial. The full trial goes into `trials`, and a few
// values are copied into their own columns so the R export is easy to filter.
export async function POST({ request }) {
	const body = await readJson(request);
	const { id, token } = session(body);
	const trial = sized(body.trial, LIMITS.trial, 'trial');
	if (!trial || typeof trial !== 'object') error(400, 'bad request');

	const pb = await getPb();
	const row = await getResponse(pb, id, token);
	const trials = row.trials || [];
	if (trials.length >= LIMITS.trials) error(413, 'too many trials');

	const update = { trials: [...trials, trial] };
	const r = trial.response && typeof trial.response === 'object' ? trial.response : {};

	switch (trial.phase) {
		case 'consent':
			update.consented = true;
			break;
		case 'screening':
			update.english_fluency = text(r.english_fluency, 50);
			update.screening_passed = trial.passed === true;
			// only before a slot is held, so a screen-out can never strand a chain
			if (trial.passed !== true && row.status === 'started') update.status = 'screened_out';
			break;
		case 'instructions_check':
			update.instructions_attempts = (row.instructions_attempts || 0) + 1;
			break;
		case 'read':
			update.read_ms = Number(trial.rt) || 0;
			break;
		case 'recall':
			update.recall_ms = Number(trial.rt) || 0;
			break;
		case 'post_survey':
			update.outside_help = text(r.outside_help, 50);
			update.instructed_response = text(r.instructed_response, 100);
			update.instructed_passed = trial.instructed_passed === true;
			update.age = Number(r.age) || null;
			update.gender = text(r.gender === 'other' ? r['gender-Comment'] || 'other' : r.gender, 100);
			break;
		case 'interaction':
			update.interaction_data = sized(trial.value, LIMITS.log, 'interaction data');
			break;
	}

	await pb.collection(RESPONSES).update(row.id, update);
	return json({ ok: true });
}
