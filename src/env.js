import { defineEnvVars } from '@sveltejs/kit/env';

// The settings the server needs. In development they come from .env; on
// Cloudflare, PB_URL and PB_APP_EMAIL come from wrangler.jsonc and the two
// secrets from `npx wrangler secret put`. All are private: none reach the browser.
export const variables = defineEnvVars({
	PB_URL: { description: 'the PocketBase instance' },
	PB_APP_EMAIL: { description: 'the whispers_app login the server uses' },
	PB_APP_PASSWORD: {},
	// optional so the site still loads without it; /api/start refuses every session instead
	STUDY_KEY: { schema: (value) => value || undefined, description: 'the ?k= part of the link' },
	// optional: without it, held chains still wait for review, just without a Slack message
	SLACK_WEBHOOK_URL: { schema: (value) => value || undefined, description: 'where held chains are announced' }
});
