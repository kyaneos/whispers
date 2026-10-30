<script>
	import { start } from '#lib/api.js';
	import { makeTimeline } from '#lib/timeline.js';
	import JSPsych from '#lib/components/JSPsych.svelte';
	import { CONTACT_EMAIL } from '#lib/config.js';

	// what a returning browser sees, by its row's status
	const MESSAGES = {
		passed: 'You have already completed this study. Thank you!',
		held: 'You have already completed this study. Thank you!',
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
	{:else if session.status === 'abandoned'}
		<!-- the reference code lets the researcher find the row, since SONA IDs are never stored -->
		<section class="page prose mx-auto mt-16 max-w-xl text-center">
			<p>
				It looks like you disconnected partway through the study, so it can’t continue from here.
				Because the study wasn’t finished, credit isn’t granted automatically. If you think you
				should get credit, for example if you closed the tab by accident, please email
				{CONTACT_EMAIL} and include this reference code: <strong>{session.id.slice(0, 6)}</strong>.
			</p>
		</section>
	{:else}
		<section class="page prose mx-auto mt-16 max-w-xl text-center">
			<p>{MESSAGES[session.status] || `Something went wrong. Please email ${CONTACT_EMAIL}.`}</p>
		</section>
	{/if}
{:catch err}
	<section class="page prose mx-auto mt-16 max-w-xl text-center">
		{#if err?.status === 403}
			<p>This link isn’t valid. Please use the exact link you were given.</p>
		{:else}
			<p>Something went wrong while loading the study. Please refresh the page.</p>
			<button class="btn btn-primary" onclick={() => window.location.reload()}>Refresh</button>
		{/if}
	</section>
{/await}
