import { get } from 'svelte/store';
import htmlButtonResponse from '@jspsych/plugin-html-button-response';
import callFunction from '@jspsych/plugin-call-function';
import survey from '@jspsych/plugin-survey';
import SvelteComponentPlugin from './jspsych-plugin-svelte';
import ReadScreen from './components/ReadScreen.svelte';
import RecallScreen from './components/RecallScreen.svelte';
import { claim } from './api';
import { SLOT } from './stores';

// Every screen carries a `phase` tag, and saving keys on it (never on
// trial_type, which jsPsych overwrites).
export function makeTimeline(jsPsych) {
	// 1. Consent
	const consent = {
		type: htmlButtonResponse,
		data: { phase: 'consent' },
		// PLACEHOLDER until the official consent text is in
		stimulus: `
			<div class="prose mx-auto text-left">
				<h2>Consent</h2>
				<p class="rounded border-2 border-dashed border-warning p-4">
					[PLACEHOLDER: official consent text pending. Course IRB protocol #811391,
					"Reproducibility of Psychological Science and Instruction".]
				</p>
			</div>`,
		choices: ['I agree']
	};

	// 2. Screening: native or fluent English passes (item 1 of telephone-v1's Quiz)
	const screening = {
		type: survey,
		data: { phase: 'screening' },
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
			data.passed = ['native', 'fluent'].includes(data.response.english_fluency);
		}
	};

	const screenedOut = {
		timeline: [
			{
				type: callFunction,
				data: { phase: 'screened_out' },
				func: () =>
					jsPsych.abortExperiment(
						'<p>Thank you for your interest. This study needs participants who are native or fluent English speakers, so it ends here.</p>'
					)
			}
		],
		conditional_function: () =>
			!jsPsych.data.get().filter({ phase: 'screening' }).last(1).values()[0].passed
	};

	// 3. Instructions and a check on the rules, repeated until passed.
	// Draft wording. It covers the rules only and never mentions memory
	let attempts = 0;
	const instructions = {
		type: htmlButtonResponse,
		data: { phase: 'instructions' },
		stimulus: () => `
			<div class="prose mx-auto text-left">
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
					jsPsych.abortExperiment(
						'<p>Sorry, there is no place open in the study right now. Please try again later.</p>'
					)
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
	const INSTRUCTED_ANSWER = 'Rarely';
	const postSurvey = {
		type: survey,
		data: { phase: 'post_survey' },
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

	// 8. Debrief: the last screen, no button
	const debrief = {
		type: htmlButtonResponse,
		data: { phase: 'debrief' },
		// PLACEHOLDER until the debrief text is in
		stimulus: `
			<div class="prose mx-auto text-left">
				<h2>Thank you</h2>
				<p class="rounded border-2 border-dashed border-warning p-4">[PLACEHOLDER: debrief text pending.]</p>
				<p>You can close this tab now.</p>
			</div>`,
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
		debrief
	];
}
