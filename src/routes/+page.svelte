<script>
	import { start } from '$lib/api';
	import { makeTimeline } from '$lib/timeline';
	import JSPsych from '$lib/components/JSPsych.svelte';

	// what a returning browser sees, by its row's status
	const MESSAGES = {
		claimed: 'This study was already started in this browser.',
		abandoned:
			'This page was reloaded after the study started, so it can’t continue. Thank you for taking part. Please contact the researcher about credit.',
		passed: 'You have already completed this study. Thank you!',
		excluded: 'You have already completed this study. Thank you!',
		screened_out: 'Thank you for your interest. This study has ended for you.'
	};
</script>

{#await start()}
	<div class="flex h-64 items-center justify-center">
		<span class="loading loading-lg loading-spinner"></span>
	</div>
{:then session}
	{#if session.status === 'started'}
		<JSPsych {makeTimeline} />
	{:else}
		<section class="prose mx-auto mt-16 text-center">
			<p>{MESSAGES[session.status] || 'Something went wrong. Please contact the researcher.'}</p>
		</section>
	{/if}
{:catch}
	<section class="prose mx-auto mt-16 text-center">
		<p>Something went wrong while loading the study. Please refresh the page.</p>
		<button class="btn btn-primary" onclick={() => window.location.reload()}>Refresh</button>
	</section>
{/await}
