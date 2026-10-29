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

	$effect(() => {
		const warn = (e) => {
			if (!canExit) e.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});

	onMount(() => {
		const jsPsych = initJsPsych({
			display_element: containerEl,
			css: false, // tailwind styles it
			default_iti: 0,
			on_trial_start,
			on_trial_finish: () => (canExit = true),
			on_data_update,
			on_finish: () => PHASE.set('done')
		});
		jsPsych.data.addProperties({ participant: $SESSION.id, test: $SESSION.test });
		if (import.meta.env.DEV) window.jspsych = jsPsych;
		jsPsych.run(makeTimeline(jsPsych));
	});
</script>

<div class="mx-auto w-full pb-20">
	<div
		bind:this={containerEl}
		class="jspsych-display-element mx-auto min-h-[80vh] w-full outline-none focus:outline-none"
	></div>
</div>
