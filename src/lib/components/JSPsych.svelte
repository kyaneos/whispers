<script>
	import { onMount } from 'svelte';
	import { initJsPsych } from 'jspsych';
	import { saveTrial } from '#lib/api.js';
	import { SESSION, PHASE } from '#lib/stores.js';

	// Trimmed from telephone-v1: one timeline, one save per trial, no resume
	const { makeTimeline } = $props();

	// Away from the tab this long while holding a slot ends the session
	const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
	// the screens where someone holds a slot
	const HOLDING_SLOT = ['read', 'recall', 'post_survey'];

	let containerEl; // where jsPsych renders
	let canExit = true;
	let phase = null; // the phase tag of the screen on show
	let hiddenAt = null; // when the tab was last hidden

	// warn before leaving mid-task, keyed on the phase tag (never trial_type)
	function on_trial_start(trial) {
		phase = trial?.data?.phase;
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

	// Back after 10+ minutes away while holding a slot: reload, and /api/start
	// marks the session abandoned and shows the disconnected message
	function onvisibilitychange() {
		if (document.hidden) {
			hiddenAt = Date.now();
		} else if (hiddenAt && Date.now() - hiddenAt > TIMEOUT_MS && HOLDING_SLOT.includes(phase)) {
			canExit = true; // no "Leave site?" warning for this reload
			window.location.reload();
		}
	}

	onMount(() => {
		window.addEventListener('beforeunload', warn);
		document.addEventListener('visibilitychange', onvisibilitychange);

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

		return () => {
			window.removeEventListener('beforeunload', warn);
			document.removeEventListener('visibilitychange', onvisibilitychange);
		};
	});
</script>

<div class="mx-auto w-full">
	<div
		bind:this={containerEl}
		class="jspsych-display-element mx-auto w-full outline-none focus:outline-none"
	></div>
</div>
