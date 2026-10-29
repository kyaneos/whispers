<script>
	import { onMount } from 'svelte';
	import { initJsPsych } from 'jspsych';
	import { saveTrial } from '#lib/api.js';
	import { SESSION, PHASE } from '#lib/stores.js';

	// Trimmed from telephone-v1: one timeline, one save per trial, no resume
	const { makeTimeline } = $props();

	let containerEl; // where jsPsych renders
	let canExit = true;

	// warn before leaving mid-task, keyed on the phase tag (never trial_type)
	function on_trial_start(trial) {
		const phase = trial?.data?.phase;
		canExit = !['read', 'recall'].includes(phase);
		if (phase) PHASE.set(phase);
	}

	// one generic save per trial
	function on_data_update(data) {
		saveTrial(data).catch((err) => console.error('save failed', err));
	}

	// the browser's "Leave site?" warning, only while canExit is false
	function warn(e) {
		if (!canExit) e.preventDefault();
	}

	onMount(() => {
		window.addEventListener('beforeunload', warn);

		const jsPsych = initJsPsych({
			display_element: containerEl,
			default_iti: 0, // no pause between screens
			on_trial_start,
			on_trial_finish: () => (canExit = true),
			on_data_update,
			on_finish: () => PHASE.set('done')
		});
		jsPsych.data.addProperties({ participant: $SESSION.id, test: $SESSION.test });
		if (import.meta.env.DEV) window.jspsych = jsPsych;
		jsPsych.run(makeTimeline(jsPsych));

		return () => window.removeEventListener('beforeunload', warn);
	});
</script>

<div class="mx-auto w-full">
	<div
		bind:this={containerEl}
		class="jspsych-display-element mx-auto w-full outline-none focus:outline-none"
	></div>
</div>
