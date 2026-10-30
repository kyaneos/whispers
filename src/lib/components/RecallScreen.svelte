<script>
	import HiddenNote from './HiddenNote.svelte';
	import { submitRecall } from '#lib/api.js';

	// Starting cutoff, to be set from the pilot data: one input event adding more
	// than this many characters is logged as a large insertion (autocomplete,
	// dictation, a paste that got through), which excludes the recall at submit
	const LARGE_INSERTION = 20;

	let { onComplete } = $props();

	let recall = $state('');
	let submitting = $state(false);
	let failed = $state(false);

	// typing log: the server compares keystrokes with the recall's length
	const t0 = performance.now();
	const ms = () => Math.round(performance.now() - t0);
	let log = { keystrokes: 0, input_events: 0, blocked_pastes: 0, first_key_ms: null, large_insertions: [] };
	let lastLength = 0;

	function onkeydown() {
		log.keystrokes++;
		log.first_key_ms ??= ms();
	}

	function oninput(e) {
		log.input_events++;
		const added = e.target.value.length - lastLength;
		if (added > LARGE_INSERTION && log.large_insertions.length < 200) {
			log.large_insertions.push({ t_ms: ms(), chars: added, input_type: e.inputType });
		}
		lastLength = e.target.value.length;
	}

	function blockPaste(e) {
		e.preventDefault();
		log.blocked_pastes++;
	}

	async function submit() {
		submitting = true;
		failed = false;
		const keystroke_log = { ...log, final_length: recall.length, submit_ms: ms() };
		try {
			await submitRecall(recall, keystroke_log);
			onComplete({ keystroke_log });
		} catch (err) {
			console.error(err);
			failed = true;
			submitting = false;
		}
	}
</script>

<div class="relative">
	<p class="mb-4 text-center font-medium text-base-content/70">
		Now, without turning back, please write out as best you can the text you just read. Be as
		accurate as possible, but don’t worry if you can’t remember it all. When you have finished
		turn the page.
	</p>
	<HiddenNote />
	<div class="page p-0">
		<textarea
			class="block h-96 w-full resize-y rounded-box border-0 bg-transparent px-10 py-9 text-lg leading-8 focus:ring-2 focus:ring-primary/40"
			bind:value={recall}
			{onkeydown}
			{oninput}
			onpaste={blockPaste}
			ondrop={blockPaste}
			autocomplete="off"
			aria-label="Your recall of the text"
		></textarea>
	</div>
	{#if failed}
		<p class="mt-4 text-center text-error">
			That didn’t save. Please check your connection and try again.
		</p>
	{/if}
	<div class="mt-6 flex justify-center">
		<button
			class="btn min-w-40 btn-lg btn-primary"
			disabled={submitting || !recall.trim()}
			onclick={submit}
		>
			{submitting ? 'Saving…' : 'Turn the page'}
		</button>
	</div>
</div>
