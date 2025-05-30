/**
 * @file src/stores/themeStore.svelte.ts
 * @description Theme management
 *
 * Features:
 * - Reactive theme state management with auto-refresh
 * - Asynchronous theme initialization from server
 * - Theme updating with server synchronization
 * - Error handling for API calls
 * - TypeScript support with custom Theme type
 */

import type { Theme } from '@src/databases/dbInterface';
import { dbAdapter } from '@src/databases/db'; // Make sure this import is active and correct

// Types
interface ThemeState {
	currentTheme: Theme | null;
	isLoading: boolean;
	error: string | null;
	lastUpdateAttempt: Date | null;
}

/**
 * Manages the application's theme state using Svelte 5 runes.
 * This class provides reactive properties and methods for theme initialization,
 * updating, and error handling, with automatic re-fetching.
 */
class ThemeStore {
	// Reactive state properties using $state()
	currentTheme = $state<Theme | null>(null);
	isLoading = $state(false);
	error = $state<string | null>(null);
	lastUpdateAttempt = $state<Date | null>(null);

	// Interval ID for auto-refresh, managed directly within the class instance
	private refreshInterval: NodeJS.Timeout | null = null;

	constructor() {
		// Initialize theme when the store is instantiated or when dependencies change.
		// Use $effect to run side effects and react to changes.
		// We'll rely on explicit calls to initialize() rather than an effect that always runs
		// to prevent unwanted re-initialization loops unless specific conditions are met.
		// Auto-refresh will handle periodic updates.
	}

	// Derived state for easy access
	get hasTheme() {
		return $derived(!!this.currentTheme);
	}

	get themeName() {
		return $derived(this.currentTheme?.name ?? 'default');
	}

	get isDefault() {
		return $derived(this.currentTheme?.isDefault ?? false);
	}

	/**
	 * Initializes the current theme by fetching the default theme from the database.
	 * Updates loading, error, and theme states accordingly.
	 * @returns Promise resolving to the fetched Theme or null.
	 */
	async initialize(): Promise<Theme | null> {
		this.isLoading = true;
		this.error = null; // Clear previous errors

		try {
			// Ensure dbAdapter is available before calling
			if (!dbAdapter) {
				throw new Error('Database adapter not initialized.');
			}
			const theme = await dbAdapter.getDefaultTheme();
			this.currentTheme = theme ?? null;
			this.lastUpdateAttempt = new Date();
			return this.currentTheme;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to initialize theme';
			console.error('Theme initialization error:', err);
			return null;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Updates the application's theme in the database and local state.
	 * Also updates the `dark` class on the `documentElement` for immediate visual feedback.
	 * @param newTheme The new theme object or its name (string).
	 * @returns Promise resolving to the updated Theme object.
	 */
	async updateTheme(newTheme: Theme | string): Promise<Theme> {
		this.isLoading = true;
		this.error = null; // Clear previous errors

		try {
			// Ensure dbAdapter is available before calling
			if (!dbAdapter) {
				throw new Error('Database adapter not initialized.');
			}

			// If a string is passed, create a basic theme object
			const themeToUpdate: Theme =
				typeof newTheme === 'string'
					? {
							name: newTheme,
							_id: '', // Placeholder, ideally this would come from a DB operation
							path: '', // Placeholder
							isDefault: false, // Placeholder
							createdAt: new Date(), // Placeholder
							updatedAt: new Date() // Placeholder
						}
					: newTheme;

			// Update the theme in the database by name
			await dbAdapter.setDefaultTheme(themeToUpdate.name);

			// Update the local state directly
			this.currentTheme = themeToUpdate;
			this.lastUpdateAttempt = new Date();

			// Update the document class for immediate visual feedback
			if (typeof window !== 'undefined') {
				document.documentElement.classList.toggle('dark', themeToUpdate.name === 'dark');
			}

			return themeToUpdate;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to update theme';
			this.error = errorMessage;
			console.error('Theme update error:', err);
			throw new Error(`Failed to update theme: ${errorMessage}`); // Re-throw for upstream handling
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Clears the current error state.
	 */
	clearError() {
		this.error = null;
	}

	/**
	 * Starts an interval to periodically re-initialize the theme.
	 * Checks if the last update attempt is older than the interval.
	 * @param interval Milliseconds between refresh checks (default: 30 minutes).
	 */
	startAutoRefresh(interval = 30 * 60 * 1000) {
		if (this.refreshInterval) {
			this.stopAutoRefresh(); // Clear any existing interval first
		}

		// Use $effect.root for lifecycle management if this needs to tie to component unmount,
		// but since it's a global store, a direct setInterval is fine,
		// and we'll manage cleanup on `window.unload`.
		this.refreshInterval = setInterval(() => {
			if (this.lastUpdateAttempt && Date.now() - this.lastUpdateAttempt.getTime() > interval) {
				this.initialize().catch((e) => console.error('Auto-refresh theme error:', e));
			}
		}, interval);
	}

	/**
	 * Stops the automatic theme refresh interval.
	 */
	stopAutoRefresh() {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
		}
	}
}

// Instantiate the single global theme store
export const themeStore = new ThemeStore();

// Optional: Automatically initialize theme on application startup (client-side)
// This effect runs once when the component/module using themeStore is first instantiated.
$effect.root(() => {
	if (typeof window !== 'undefined') {
		themeStore.initialize().catch(console.error);

		// Start auto-refresh after initial load
		themeStore.startAutoRefresh();

		// Clean up auto-refresh on window unload
		window.addEventListener('unload', () => themeStore.stopAutoRefresh());
	}
});
