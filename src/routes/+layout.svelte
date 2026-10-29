<script>
	import '../app.css';
	import '@jspsych/plugin-survey/css/survey.css';
	import UnsupportedDeviceScreen from '#lib/components/UnsupportedDeviceScreen.svelte';
	import StudyBar from '#lib/components/StudyBar.svelte';

	let { children } = $props();

	// TEL-118 (v1): desktop only. ssr=false, so window exists during init
	const uiCompatible =
		typeof window !== 'undefined' &&
		window.matchMedia('(any-pointer: fine) and (any-hover: hover)').matches;
</script>

{#if !uiCompatible}
	<UnsupportedDeviceScreen />
{:else}
	<main class="mx-auto w-full max-w-4xl px-6 pt-6 pb-20">
		{@render children()}
	</main>
	<StudyBar />
{/if}
