// Who participants contact about problems or credit
export const CONTACT_EMAIL = 'jmoran@ucsd.edu';

// The SONA study's client-side completion URL, from Study Info > Website, minus
// its survey_code (added below). Fill in the two values before collection
const SONA_CREDIT_URL =
	'https://ucsd.sona-systems.com/webstudy_credit.aspx?experiment_id=EXPERIMENT_ID&credit_token=CREDIT_TOKEN';

// SONA credit redirect, adapted from the Cognitive Tools Lab's guide (Judy Fan's lab):
// https://github.com/cogtoolslab/handy_tips/blob/main/automate_sona_creditassignment.md
// SONA adds a survey_code to the study link. It stays in the address bar and is
// never saved, since the consent form promises SONA IDs are never tied to
// responses. Only digits are accepted, because it goes into the page. Without a
// code (the test link, the pilot) there is no credit link
const surveyCode = new URLSearchParams(window.location.search).get('survey_code') || '';
export const CREDIT_LINK = /^\d+$/.test(surveyCode) ? `${SONA_CREDIT_URL}&survey_code=${surveyCode}` : '';
