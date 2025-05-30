/**
 * @file src/stores/systemPreferences.svelte.ts
 * @description User dashboard system preferences management (syncs with DB via API)
 *
 * Features:
 * - Reactive user preferences management with auto-refresh
 * - Loads and saves preferences from/to server API
 * - Error handling for API calls
 * - TypeScript support with custom WidgetPreference type
 */

// We will rely on ScreenSize enum and not the 'store' utility
import { ScreenSize } from '@stores/screenSizeStore.svelte';

// Widget preference interface
export interface WidgetPreference {
	id: string;
	component: string;
	label: string;
	icon: string;
	x: number;
	y: number;
	w: number;
	h: number;
	min?: { w: number; h: number };
	max?: { w: number; h: number };
	movable?: boolean;
	resizable?: boolean;
	defaultW?: number;
	defaultH?: number;
	validSizes?: { w: number; h: number }[];
}

// User preferences interface
export interface UserPreferences {
	[ScreenSize.SM]: WidgetPreference[];
	[ScreenSize.MD]: WidgetPreference[];
	[ScreenSize.LG]: WidgetPreference[];
	[ScreenSize.XL]: WidgetPreference[];
	// Consider adding 2XL if your ScreenSize enum includes it and Tailwind uses it for widgets
	// [ScreenSize.XXL]?: WidgetPreference[];
}

// Initial state for preferences (as a constant for reset)
const DEFAULT_PREFERENCES: UserPreferences = {
	[ScreenSize.SM]: [],
	[ScreenSize.MD]: [],
	[ScreenSize.LG]: [],
	[ScreenSize.XL]: []
	// [ScreenSize.XXL]: [], // Uncomment if XXL is added to ScreenSize enum and used
};

/**
 * Manages user dashboard system preferences, including loading from and saving to a backend API.
 * Utilizes Svelte 5 runes for reactive and efficient state management.
 */
class SystemPreferencesStore {
	// Core reactive state properties using $state()
	preferences = $state<UserPreferences>(DEFAULT_PREFERENCES);
	isLoading = $state(false);
	error = $state<string | null>(null);
	currentUserId = $state<string | null>(null);

	constructor() {
		// No specific initialization in the constructor, relies on methods to load preferences.
	}

	// --- Derived State ($derived) ---

	/**
	 * True if there are any preferences configured across all screen sizes.
	 */
	get hasPreferences(): boolean {
		return $derived(Object.values(this.preferences).some((widgets) => widgets.length > 0));
	}

	/**
	 * The total count of all widgets configured across all screen sizes.
	 */
	get widgetCount(): number {
		return $derived(Object.values(this.preferences).reduce((sum, widgets) => sum + widgets.length, 0));
	}

	// --- Public Methods to Mutate State and Interact with API ---

	/**
	 * Retrieves widgets for a specific screen size.
	 * @param size The ScreenSize enum value.
	 * @returns An array of WidgetPreference for the given screen size.
	 */
	getScreenSizeWidgets(size: ScreenSize): WidgetPreference[] {
		// Directly access the reactive state. The caller will use $derived if they want reactivity.
		// No need for a separate derived `store(() => ...)` here.
		return this.preferences[size];
	}

	/**
	 * Loads user preferences from the backend API.
	 * Updates isLoading, error, and preferences states.
	 * @param userId The ID of the current user.
	 */
	async loadPreferences(userId: string) {
		this.isLoading = true;
		this.error = null; // Clear previous errors
		this.currentUserId = userId; // Update current user ID

		try {
			// Ensure API endpoint is correct and accessible
			const res = await fetch('/api/systemPreferences', { method: 'GET' });
			if (!res.ok) {
				const errorBody = await res.text(); // Get text for more detailed error
				throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorBody}`);
			}

			const apiResponse = await res.json();
			const loadedPrefs = apiResponse.preferences as UserPreferences;

			// Update preferences, defaulting to empty if API returns null/undefined
			this.preferences = loadedPrefs || DEFAULT_PREFERENCES;
			this.error = null; // Clear any previous errors on success
		} catch (e) {
			this.error = e instanceof Error ? e.message : 'Failed to load preferences';
			console.error('Failed to load preferences:', e);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Sets the entire set of widgets for a specific screen size.
	 * Updates the in-memory state and persists to the backend API.
	 * @param userId The ID of the current user.
	 * @param screenSizeValue The ScreenSize enum value for which to set preferences.
	 * @param widgets An array of WidgetPreference to set.
	 */
	async setPreference(userId: string, screenSizeValue: ScreenSize, widgets: WidgetPreference[]) {
		// Update in-memory state first for immediate UI feedback
		this.preferences = { ...this.preferences, [screenSizeValue]: widgets };
		this.currentUserId = userId; // Keep user ID in sync

		// Persist to DB asynchronously
		try {
			const res = await fetch('/api/systemPreferences', {
				method: 'POST', // Use POST for saving the entire state
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ preferences: this.preferences }) // Send the complete current state
			});
			if (!res.ok) {
				const errorBody = await res.text();
				throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorBody}`);
			}
			// Optionally, handle success response from API if needed
		} catch (e) {
			// Do not change isLoading/error state for non-critical background persistence errors
			console.error('Failed to persist preferences:', e);
		}
	}

	/**
	 * Clears all user preferences across all screen sizes.
	 * Updates the in-memory state and persists the empty state to the backend API.
	 * @param userId The ID of the current user.
	 */
	async clearPreferences(userId: string) {
		// Update in-memory state to empty
		this.preferences = DEFAULT_PREFERENCES;
		this.currentUserId = userId;

		// Persist cleared state to DB
		try {
			const res = await fetch('/api/systemPreferences', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ preferences: DEFAULT_PREFERENCES })
			});
			if (!res.ok) {
				const errorBody = await res.text();
				throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorBody}`);
			}
		} catch (e) {
			console.error('Failed to persist cleared preferences:', e);
		}
	}

	/**
	 * Adds a single widget to the preferences for a specific screen size.
	 * @param userId The ID of the current user.
	 * @param screenSizeValue The ScreenSize enum value.
	 * @param widget The WidgetPreference to add.
	 */
	addWidget(userId: string, screenSizeValue: ScreenSize, widget: WidgetPreference) {
		// Create a new array and new preferences object to ensure reactivity
		const updatedWidgets = [...this.preferences[screenSizeValue], widget];
		this.preferences = {
			...this.preferences,
			[screenSizeValue]: updatedWidgets
		};
		this.currentUserId = userId; // Keep user ID in sync
		// Note: This does not automatically persist. Call setPreference after batching changes.
	}

	/**
	 * Removes a single widget from the preferences for a specific screen size.
	 * @param userId The ID of the current user.
	 * @param screenSizeValue The ScreenSize enum value.
	 * @param widgetId The ID of the widget to remove.
	 */
	removeWidget(userId: string, screenSizeValue: ScreenSize, widgetId: string) {
		// Create a new array and new preferences object to ensure reactivity
		const updatedWidgets = this.preferences[screenSizeValue].filter((w) => w.id !== widgetId);
		this.preferences = {
			...this.preferences,
			[screenSizeValue]: updatedWidgets
		};
		this.currentUserId = userId; // Keep user ID in sync
		// Note: This does not automatically persist. Call setPreference after batching changes.
	}

	// --- Utility methods if needed, e.g., for clearing general store errors ---
	clearError() {
		this.error = null;
	}
}

// --- Global Store Instance ---
// Instantiate the single global system preferences store.
export const systemPreferencesStore = new SystemPreferencesStore();

// --- Exported Aliases for Convenience ---
// Components can import these directly for convenience, or use `systemPreferencesStore.property`
export const {
	preferences,
	isLoading,
	error,
	currentUserId,
	hasPreferences, // Derived getter
	widgetCount, // Derived getter
	getScreenSizeWidgets,
	loadPreferences,
	setPreference,
	clearPreferences,
	addWidget,
	removeWidget,
	clearError // Utility method
} = systemPreferencesStore;
