// Who participants contact about problems or payment
export const CONTACT_EMAIL = 'jmoran@ucsd.edu';

// The Prolific study's completion code, from its setup page (Approve and pay). It is also shown
// as text, so someone whose button doesn't work can still enter it on Prolific
export const COMPLETION_CODE = 'CUZ5QB4T';
const PROLIFIC_COMPLETION_URL = `https://app.prolific.com/submissions/complete?cc=${COMPLETION_CODE}`;

// Prolific adds PROLIFIC_PID to the study link. It is only checked for, never
// saved, since the consent form promises Prolific IDs are never tied to
// responses. Without it (the test link, the pilot) there is no completion link
const fromProlific = new URLSearchParams(window.location.search).has('PROLIFIC_PID');
export const COMPLETION_LINK = fromProlific ? PROLIFIC_COMPLETION_URL : '';
