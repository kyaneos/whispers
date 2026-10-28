import { mount, unmount } from 'svelte';
import { ParameterType } from 'jspsych';

/**
 * Custom jsPsych plugin that renders Svelte components within trials
 * This allows seamless integration of Svelte components in jsPsych timelines
 *
 * @author Your Lab
 * @see {@link https://jspsych.org/latest/developers/plugin-development/}
 */

const info = {
	name: 'svelte-component',
	version: '1.0.0',
	parameters: {
		/** The Svelte component constructor to render */
		component: {
			type: ParameterType.FUNCTION,
			default: undefined
		},
		/** Props to pass to the Svelte component */
		props: {
			type: ParameterType.OBJECT,
			default: {}
		},
		/** CSS classes to apply to the container element */
		container_class: {
			type: ParameterType.STRING,
			default: ''
		},
		/** How long to show the trial in milliseconds. null = wait for response */
		trial_duration: {
			type: ParameterType.INT,
			default: null
		},
		/** If true, the trial will end when the component triggers a response */
		response_ends_trial: {
			type: ParameterType.BOOL,
			default: true
		},
		/** If true, saves any data emitted by the component */
		save_component_data: {
			type: ParameterType.BOOL,
			default: true
		},
		/** Data to add to the trial */
		data: {
			type: ParameterType.OBJECT,
			default: {}
		}
	},
	data: {
		/** The component name or identifier */
		component: {
			type: ParameterType.STRING
		},
		/** Data emitted by the component */
		component_data: {
			type: ParameterType.OBJECT
		}
	}
};

class SvelteComponentPlugin {
	constructor(jsPsych) {
		this.jsPsych = jsPsych;
		this.component_instance = null;
	}

	trial(display_element, trial) {
		// Create container for Svelte component
		const container = document.createElement('div');
		container.className = trial.container_class || '';
		display_element.appendChild(container);

		// Track trial data
		let trial_data = {
			rt: null,
			component: trial.component.name || 'unknown',
			component_data: {}
		};

		// Start time
		const start_time = performance.now();

		// Function to end trial
		const end_trial = () => {
			// Calculate response time
			const end_time = performance.now();
			trial_data.rt = Math.round(end_time - start_time);

			// Merge original trial data (preserves trial_type, phase, etc.)
			const final_data = { ...trial.data, ...trial_data };

			// Cleanup component using Svelte 5 unmount() API
			if (this.component_instance) {
				unmount(this.component_instance);
				this.component_instance = null;
			}

			// Clear display
			display_element.innerHTML = '';

			// End trial
			this.jsPsych.finishTrial(final_data);
		};

		// Enhanced props with callbacks - ensure props exist
		const trialProps = trial.props || {};

		const enhanced_props = {
			...trialProps,
			// Add callback for component to signal completion
			onComplete: (data) => {
				if (trial.save_component_data && data) {
					trial_data.component_data = data;
				}
				if (trial.response_ends_trial) {
					end_trial();
				}
			},
			// Add callback for component to save intermediate data
			onDataUpdate: (data) => {
				if (trial.save_component_data && data) {
					trial_data.component_data = { ...trial_data.component_data, ...data };
				}
			},
			// Pass jsPsych instance if component needs it
			jsPsych: this.jsPsych
		};

		// Mount the Svelte component using Svelte 5 mount() API
		try {
			// Use Svelte 5 mount() function instead of constructor
			this.component_instance = mount(trial.component, {
				target: container,
				props: enhanced_props
			});
		} catch (error) {
			console.error('❌ Failed to mount Svelte component:', error);
			trial_data.error = error.message;
			end_trial();
			return;
		}

		// Set trial duration if specified
		if (trial.trial_duration !== null) {
			this.jsPsych.pluginAPI.setTimeout(() => {
				end_trial();
			}, trial.trial_duration);
		}
	}

	simulate(trial, simulation_mode, simulation_options, load_callback) {
		if (simulation_mode == 'data-only') {
			load_callback();
			this.simulate_data_only(trial, simulation_options);
		}
		if (simulation_mode == 'visual') {
			this.simulate_visual(trial, simulation_options, load_callback);
		}
	}

	simulate_data_only(trial) {
		const data = {
			rt: this.jsPsych.randomization.sampleExGaussian(500, 50, 1 / 150, true),
			component: trial.component.name || 'unknown',
			component_data: {}
		};

		this.jsPsych.finishTrial(data);
	}

	simulate_visual(trial, simulation_options, load_callback) {
		const data = {
			rt: this.jsPsych.randomization.sampleExGaussian(500, 50, 1 / 150, true),
			component: trial.component.name || 'unknown',
			component_data: {}
		};

		const display_element = this.jsPsych.getDisplayElement();

		this.trial(display_element, trial);
		load_callback();

		if (trial.trial_duration !== null) {
			this.jsPsych.pluginAPI.setTimeout(() => {
				// Component will end itself
			}, trial.trial_duration);
		} else {
			this.jsPsych.pluginAPI.setTimeout(() => {
				if (this.component_instance) {
					// In Svelte 5, we can't access internal props like this
					// Component should handle its own completion logic
					// If needed, we could finish the trial here as a fallback
					this.jsPsych.finishTrial(data);
				}
			}, data.rt);
		}
	}
}

SvelteComponentPlugin.info = info;

export default SvelteComponentPlugin;
