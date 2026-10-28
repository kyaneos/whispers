import { json, error } from '@sveltejs/kit';
import { getPb, getResponse, RESPONSES } from '$lib/server/pb';

// One generic save per trial. The full trial goes into `trials`, and a few
// values are copied into their own columns so the R export is easy to filter.
export async function POST({ request, platform }) {
	const { id, token, trial } = await request.json();
	const pb = await getPb(platform);
	const row = await getResponse(pb, id, token).catch(() => error(403));

	const update = { trials: [...(row.trials || []), trial] };
	const r = trial.response || {};

	switch (trial.phase) {
		case 'consent':
			update.consented = true;
			break;
		case 'screening':
			update.english_fluency = r.english_fluency || '';
			update.screening_passed = trial.passed;
			if (!trial.passed) update.status = 'screened_out';
			break;
		case 'instructions_check':
			update.instructions_attempts = (row.instructions_attempts || 0) + 1;
			break;
		case 'read':
			update.read_ms = trial.rt;
			break;
		case 'recall':
			update.recall_ms = trial.rt;
			break;
		case 'post_survey':
			update.outside_help = r.outside_help || '';
			update.instructed_response = r.instructed_response || '';
			update.instructed_passed = trial.instructed_passed;
			update.age = Number(r.age) || null;
			update.gender = r.gender === 'other' ? r['gender-Comment'] || 'other' : r.gender || '';
			break;
		case 'interaction':
			update.interaction_data = trial.value;
			break;
	}

	await pb.collection(RESPONSES).update(row.id, update);
	return json({ ok: true });
}
