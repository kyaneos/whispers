// Who participants contact about problems or payment
export const CONTACT_EMAIL = 'jmoran@ucsd.edu';

// The Prolific study's completion URL, from its setup page (Approve and pay)
const PROLIFIC_COMPLETION_URL = 'https://app.prolific.com/submissions/complete?cc=CUZ5QB4T';

// Prolific adds PROLIFIC_PID to the study link. It is only checked for, never
// saved, since the consent form promises Prolific IDs are never tied to
// responses. Without it (the test link, the pilot) there is no completion link
const fromProlific = new URLSearchParams(window.location.search).has('PROLIFIC_PID');
export const COMPLETION_LINK = fromProlific ? PROLIFIC_COMPLETION_URL : '';
