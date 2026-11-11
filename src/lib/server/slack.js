import { SLACK_WEBHOOK_URL } from '$app/env/private';

// Posts a line to the study's Slack channel: every exclusion, and every held
// chain waiting for review. A failed message never blocks the participant
export async function announce(text) {
	if (!SLACK_WEBHOOK_URL) return;
	try {
		await fetch(SLACK_WEBHOOK_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text })
		});
	} catch (err) {
		console.error('slack message failed', err);
	}
}
