import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// Optimize dependencies and properly handle @sveltejs/svelte-virtual-list
	optimizeDeps: {
		include: ['@sveltejs/svelte-virtual-list'],
		esbuildOptions: {
			mainFields: ['svelte', 'browser', 'module', 'main']
		}
	},
	build: {
		commonjsOptions: {
			transformMixedEsModules: true
		}
	},
	// Explicitly specify the main fields for package resolution
	resolve: {
		mainFields: ['svelte', 'browser', 'module', 'main'],
		dedupe: ['svelte']
	}
});
