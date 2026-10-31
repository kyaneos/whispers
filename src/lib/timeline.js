import { get } from 'svelte/store';
import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import callFunction from '@jspsych/plugin-call-function';
import survey from '@jspsych/plugin-survey';
import SvelteComponentPlugin from './jspsych-plugin-svelte';
import ReadScreen from './components/ReadScreen.svelte';
import RecallScreen from './components/RecallScreen.svelte';
import { claim, finish } from './api';
import { SLOT } from './stores';
import { CONTACT_EMAIL, CREDIT_LINK } from './config';

// The button back to SONA, on every screen where the study ends (none on the test link)
const CREDIT_BUTTON = CREDIT_LINK
	? `<div class="mt-10 text-center"><a class="btn min-w-40 btn-lg btn-primary" href="${CREDIT_LINK}">Finish and get credit</a></div>`
	: '';

// The answer the instructed-response item asks for
const INSTRUCTED_ANSWER = 'Rarely';

// English fluency levels that pass screening
const FLUENT = ['native', 'fluent'];

// The official consent text for course IRB protocol #811391, "Reproducibility of
// Psychological Science and Instruction", word for word. Only the spacing and one
// missing period are fixed
const CONSENT_HTML = `
	<div class="page prose max-w-none text-left">
		<h2>Consent</h2>
		<p>You are being invited to participate in a research study titled “Reproducibility of Psychological Science and Instruction.” This study is being done by Dr. Bria Long from UC San Diego and associated graduate students in Experimental Methods course. You were selected to participate in this study because you are an adult in the U.S. and have been a represented population in previous psychology studies.</p>
		<p>The purpose of this study is to better understand how well previously published studies in the psychological field replicate online and with different populations. Your participation in this research should last approximately 5-30 minutes. If you agree to take part in this study, you may be asked to view a set of stimuli, including pictures, sounds, written text, or videos and then giving some responses via key-presses, verbally, or with paper-and-pencil. We may also observe your choices or preferences among an array of stimuli. These stimuli will be taken directly from or closely adapted from studies that already exist in the published psychological literature. Stimuli will include, e.g., pictures of objects and human faces, audio and video clips, short text passages, etc. None of the stimuli will be disturbing, threatening, or offensive. The online and in-person experiments described in this protocol will take no more than 30 minutes. An example game you might play would be to click on an image on the screen that matches a word you hear being said out loud. Your total expected time commitment for this study is between 5-30 minutes, and is specified in the study description.</p>
		<p>Your participation in this study is completely voluntary and you can withdraw at any time. Choosing not to participate or withdrawing will result in no penalty or loss of benefits to which you are entitled. You are free to skip any question that you choose.</p>
		<p>We will not be asking for any personally identifying information, and we will handle responses as confidentially as possible. Your SONA or Prolific IDs will never be tied to your responses on this survey. However, we cannot guarantee the confidentiality of information transmitted over the Internet. To minimize this risk, data containing anything that might be personally identifiable (e.g. Prolific IDs or IP addresses) will be encrypted on transfer and storage and will only be accessible to qualified lab personnel. We will be keeping data collected as part of this experiment indefinitely. This anonymized data (containing neither Prolific IDs nor IP addresses) may be shared with the scientific community or with other participants to be used as stimuli in future studies.</p>
		<p>If you have questions about this project or if you have a research-related problem, you may contact the researcher(s), Dr. Bria Long, brlong@ucsd.edu. If you have any questions concerning your rights as a research subject, you may contact the UC San Diego Office of IRB Administration at irb@ucsd.edu or 858-246-4777.</p>
		<p>By participating in this research you are indicating that you are at least 18 years old, have read this consent form, and agree to participate in this research study. Please keep this consent form for your records.</p>
	</div>`;

// Debrief text approved 2026-10-28 (TEL-228)
const DEBRIEF_HTML = `
	<div class="page prose max-w-none">
		<h2 class="text-center">Debrief</h2>
		<p>Thank you so much for taking part! This study looks at how narratives change as they get passed from person to person, like in the game of telephone. The text you read was either one of our original passages or what the person before you remembered of it, and what you wrote will be passed on as the text for the next person in your chain. We’re curious whether some kinds of information hold up better than others as a story gets retold. Please don’t share the details of this study with anyone who might take part, since knowing what we’re looking for could change how they read and remember.</p>
	</div>
	${CREDIT_BUTTON || '<p class="mt-10 text-center italic text-base-content/70">You can close this tab now.</p>'}`;

// The two screens where the study ends early. Both still get the credit button
const SCREENED_OUT_HTML = `<div class="page prose max-w-none"><p>Thank you for your interest. This study needs participants who are native or fluent English speakers, so it ends here.</p></div>${CREDIT_BUTTON}`;
const NO_SLOT_HTML = `<div class="page prose max-w-none"><p>Every place in the study is taken right now. Please contact ${CONTACT_EMAIL} if you have any questions.</p></div>${CREDIT_BUTTON}`;

// Survey screens keep Continue grey and disabled until every required question
// has an answer, the same as the buttons on the other screens
function gateContinue(survey) {
	const update = () => {
		const ready = survey
			.getAllQuestions()
			.every((q) => !q.isRequired || !q.isEmpty());
		const button = document.querySelector('.jspsych-nav-complete');
		if (button) button.disabled = !ready;
	};
	survey.onAfterRenderSurvey.add(update);
	survey.onValueChanged.add(update);
}

// Every screen carries a `phase` tag, and saving keys on it (never on
// trial_type, which jsPsych overwrites).
export function makeTimeline(jsPsych) {
	// how many times the rules check has been answered, for the "read again" note
	let attempts = 0;

	// 1. Consent
	const consent = {
		type: htmlButtonResponse,
		data: { phase: 'consent' },
		stimulus: CONSENT_HTML,
		choices: ['I agree']
	};

	// 2. Screening: native or fluent English passes (item 1 of telephone-v1's Quiz)
	const screening = {
		type: survey,
		data: { phase: 'screening' },
		survey_function: gateContinue,
		survey_json: {
			showQuestionNumbers: false,
			completeText: 'Continue',
			elements: [
				{
					type: 'radiogroup',
					name: 'english_fluency',
					title: 'How would you rate your English fluency?',
					isRequired: true,
					choices: [
						{ value: 'native', text: 'Native speaker' },
						{ value: 'fluent', text: 'Fluent (can speak, read, and write without difficulty)' },
						{ value: 'intermediate', text: 'Intermediate (some difficulty with complex topics)' },
						{ value: 'basic', text: 'Basic (can communicate simple ideas)' }
					]
				}
			]
		},
		on_finish: (data) => {
			data.passed = FLUENT.includes(data.response.english_fluency);
		}
	};

	const screenedOut = {
		timeline: [
			{
				type: callFunction,
				data: { phase: 'screened_out' },
				func: () =>
jsPsych.abortExperiment(SCREENED_OUT_HTML)
			}
		],
		conditional_function: () =>
			!jsPsych.data.get().filter({ phase: 'screening' }).last(1).values()[0].passed
	};

	// 3. Instructions and a check on the rules, repeated until passed.
	// Draft wording. It covers the rules only and never mentions memory
	const instructions = {
		type: htmlButtonResponse,
		data: { phase: 'instructions' },
		stimulus: () => `
			<div class="page prose max-w-none text-left">
				${attempts > 0 ? '<p class="text-error">Some of those answers weren’t right. Please read the instructions again.</p>' : ''}
				<h2>Instructions</h2>
				<p>On the next page you will see a short text. Please read it through once, at your normal pace.</p>
				<p>When you have finished, turn the page. Once you turn the page, you won’t be able to go back to the text.</p>
			</div>`,
		choices: ['Continue']
	};

	const instructionsCheck = {
		type: survey,
		data: { phase: 'instructions_check' },
		survey_function: gateContinue,
		survey_json: {
			showQuestionNumbers: false,
			completeText: 'Continue',
			elements: [
				{
					type: 'radiogroup',
					name: 'read_times',
					title: 'How many times should you read the text?',
					isRequired: true,
					choices: ['Once, straight through', 'As many times as I like']
				},
				{
					type: 'radiogroup',
					name: 'go_back',
					title: 'After you turn the page, can you go back to the text?',
					isRequired: true,
					choices: ['Yes', 'No']
				}
			]
		},
		on_finish: (data) => {
			attempts++;
			data.passed =
				data.response.read_times === 'Once, straight through' && data.response.go_back === 'No';
		}
	};

	const instructionsLoop = {
		timeline: [instructions, instructionsCheck],
		loop_function: (data) => !data.filter({ phase: 'instructions_check' }).last(1).values()[0].passed
	};

	// Claim a slot only now, so people who screen out never hold one
	const claimSlot = {
		type: callFunction,
		data: { phase: 'claim' },
		async: true,
		func: async (done) => {
			const slot = await claim();
			SLOT.set(slot);
			if (slot.chain) {
				jsPsych.data.addProperties({
					chain: slot.chain,
					generation: slot.generation,
					order: slot.order
				});
			}
			done({ chain: slot.chain, generation: slot.generation, order: slot.order });
		}
	};

	const noSlot = {
		timeline: [
			{
				type: callFunction,
				data: { phase: 'no_slot' },
				func: () =>
jsPsych.abortExperiment(NO_SLOT_HTML)
			}
		],
		conditional_function: () => !get(SLOT)?.chain
	};

	// 4. Read, 5. Recall: Svelte screens through v1's wrapper
	const read = {
		type: SvelteComponentPlugin,
		component: ReadScreen,
		props: () => ({ text: get(SLOT).input_text }),
		data: { phase: 'read' }
	};

	const recall = {
		type: SvelteComponentPlugin,
		component: RecallScreen,
		data: { phase: 'recall' }
	};

	// 7. Honesty item, instructed-response item, age and gender
	const postSurvey = {
		type: survey,
		data: { phase: 'post_survey' },
		survey_function: gateContinue,
		survey_json: {
			showQuestionNumbers: false,
			completeText: 'Continue',
			elements: [
				{
					type: 'radiogroup',
					name: 'outside_help',
					title:
						'Did you use any outside help while writing your response, such as notes, another person, or an AI tool? Please answer honestly. Your answer won’t affect your credit.',
					isRequired: true,
					choices: ['No', 'Yes']
				},
				{
					type: 'radiogroup',
					name: 'instructed_response',
					title: `To show you are reading carefully, please select “${INSTRUCTED_ANSWER}” for this question.`,
					isRequired: true,
					choices: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always']
				},
				{
					type: 'text',
					name: 'age',
					title: 'What is your age?',
					inputType: 'number',
					min: 18,
					max: 120,
					isRequired: true
				},
				{
					type: 'radiogroup',
					name: 'gender',
					title: 'What is your gender?',
					isRequired: true,
					choices: ['Woman', 'Man', 'Non-binary', 'Prefer not to say'],
					showOtherItem: true,
					otherText: 'Self-describe'
				}
			]
		},
		on_finish: (data) => {
			data.instructed_passed = data.response.instructed_response === INSTRUCTED_ANSWER;
		}
	};

	// Focus and blur events, saved once at the end
	const interaction = {
		type: callFunction,
		data: { phase: 'interaction' },
		func: () => jsPsych.data.getInteractionData().values()
	};

	// Everything is saved: the server now passes the recall on, holds it for
	// review, or excludes it. A failure here shows nothing to the participant
	const decide = {
		type: callFunction,
		data: { phase: 'finish' },
		async: true,
		func: (done) =>
			finish()
				.catch((err) => console.error('finish failed', err))
				.then(() => done())
	};

	// 8. Debrief: the last screen, no button
	const debrief = {
		type: htmlButtonResponse,
		data: { phase: 'debrief' },
		stimulus: DEBRIEF_HTML,
		choices: []
	};

	return [
		consent,
		screening,
		screenedOut,
		instructionsLoop,
		claimSlot,
		noSlot,
		read,
		recall,
		postSurvey,
		interaction,
		decide,
		debrief
	];
}
