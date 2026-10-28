<script>
	import { onMount } from 'svelte';
	import HiddenNote from './HiddenNote.svelte';
	import { readingFloorMs } from '$lib/materials';

	let { text, onComplete } = $props();

	// split on blank lines, so G1 shows its four paragraphs separately
	const paragraphs = $derived(text.split(/\n\s*\n/));
	const floorMs = $derived(readingFloorMs(text));

	// the button unlocks after the reading floor (400 words per minute)
	let ready = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (ready = true), floorMs);
		return () => clearTimeout(timer);
	});

	const block = (e) => e.preventDefault();
</script>

<div
	class="relative mx-auto max-w-2xl select-none"
	oncopy={block}
	oncut={block}
	oncontextmenu={block}
	ondragstart={block}
	role="presentation"
>
	<p class="font-semibold">
		Please read the following text through once. When you have finished turn the page.
	</p>
	{#each paragraphs as paragraph}
		<p class="text-lg leading-relaxed">{paragraph}</p>
	{/each}
	<HiddenNote />
	<div class="mt-12 text-center">
		<button
			class="btn btn-lg btn-primary"
			disabled={!ready}
			onclick={() => onComplete({ floor_ms: floorMs })}
		>
			Turn the page
		</button>
	</div>
</div>
