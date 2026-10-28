import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	{ ignores: ['.svelte-kit/', '.wrangler/', 'node_modules/'] },
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js'],
		rules: {
			'svelte/require-each-key': 'off',
			'svelte/no-useless-mustaches': 'off'
		}
	}
];
