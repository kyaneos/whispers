<script>
	import { onMount } from 'svelte';
	import HiddenNote from './HiddenNote.svelte';
	import { readingFloorMs } from '#lib/materials.js';

	let { text, onComplete } = $props();

	// split on blank lines, so the original text shows as four separate paragraphs
	const paragraphs = text.split(/\n\s*\n/);
	const floorMs = readingFloorMs(text);

	// the button unlocks after the reading floor (400 words per minute)
	let ready = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (ready = true), floorMs);
		return () => clearTimeout(timer);
	});

	// select-none already stops highlighting; these stop copy and the right-click menu
	const block = (e) => e.preventDefault();
</script>

<div
	class="relative select-none"
	oncopy={block}
	oncontextmenu={block}
	role="presentation"
>
	<p class="mb-4 text-center font-medium text-base-content/70">
		Please read the following text through once. When you have finished turn the page.
	</p>
	<article class="page space-y-6 !px-12 !py-10 text-[1.0625rem] leading-8">
		{#each paragraphs as paragraph}
			<p>{paragraph}</p>
		{/each}
	</article>
	<HiddenNote />
	<div class="mt-6 flex flex-col items-center gap-2">
		<button
			class="btn min-w-40 btn-lg btn-primary"
			disabled={!ready}
			onclick={() => onComplete({ floor_ms: floorMs })}
		>
			Turn the page
		</button>
		<p class="page-note h-5">
			{#if !ready}You’ll be able to turn the page in a moment.{/if}
		</p>
	</div>
</div>
