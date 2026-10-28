// Runs on every request. Adds the security headers SvelteKit doesn't set itself.
// The Content Security Policy is in vite.config.js, where SvelteKit can add its nonce.
export async function handle({ event, resolve }) {
	const response = await resolve(event);
	const h = response.headers;
	h.set('X-Content-Type-Options', 'nosniff'); // never guess a file's type
	h.set('X-Frame-Options', 'DENY'); // never show the study inside another site
	h.set('Referrer-Policy', 'strict-origin-when-cross-origin'); // the link's key never leaves the site
	h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	h.set('X-Robots-Tag', 'noindex, nofollow'); // keep the study out of search engines
	h.set('Cross-Origin-Opener-Policy', 'same-origin');
	if (event.url.pathname.startsWith('/api/')) h.set('Cache-Control', 'no-store');
	return response;
}
