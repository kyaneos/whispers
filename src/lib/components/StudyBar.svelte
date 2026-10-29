<script>
	import { PHASE } from '#lib/stores.js';
	import { CONTACT_EMAIL } from '#lib/config.js';

	// Each screen's phase tag, mapped to its step and the label the participant sees.
	// The claim step shows no screen of its own, so it borrows the reading label.
	const STEPS = [
		{ phases: ['consent'], label: 'Consent' },
		{ phases: ['screening', 'screened_out'], label: 'Screening' },
		{ phases: ['instructions', 'instructions_check'], label: 'Instructions' },
		{ phases: ['claim', 'no_slot', 'read'], label: 'Reading' },
		{ phases: ['recall'], label: 'Writing' },
		{ phases: ['post_survey'], label: 'Survey' },
		{ phases: ['interaction', 'debrief', 'done'], label: 'Debrief' }
	];

	const step = $derived(STEPS.findIndex((s) => s.phases.includes($PHASE)));
	const progress = $derived(step < 0 ? 0 : step / (STEPS.length - 1));
</script>

<footer
	class="fixed right-0 bottom-0 left-0 z-50 border-t border-base-300 bg-base-100/95 backdrop-blur"
>
	<div
		class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-8 gap-y-1 px-4 py-2"
	>
		{#if step >= 0}
			<div class="flex min-w-0 flex-1 items-center gap-3">
				<span class="w-32 shrink-0 text-xs font-medium text-base-content/70">
					{STEPS[step].label}
				</span>
				<progress class="progress h-1.5 w-full max-w-xs progress-primary" value={progress} max="1"
				></progress>
				<span class="w-10 shrink-0 text-right text-xs text-base-content/50 tabular-nums">
					{Math.round(progress * 100)}%
				</span>
			</div>
		{:else}
			<div></div>
		{/if}
		<p class="text-xs text-base-content/50">
			Questions or problems? <a class="link link-primary" href="mailto:{CONTACT_EMAIL}"
				>{CONTACT_EMAIL}</a
			>
		</p>
	</div>
</footer>
