/**
 * @file src/stores/screenSizeStore.svelte.ts
 * @description Manages the screen size states using Svelte 5 runes
 *
 * Features:
 * - Enum for different screen sizes matching Tailwind CSS breakpoints
 * - Reactive tracking of window width and height
 * - Derived states for common screen size categories (mobile, tablet, desktop)
 * - Debounced updates for performance during resize events
 * - Automatic initialization and cleanup using $effect.root
 */

// Enum for screen sizes (matches Tailwind CSS breakpoints)
export enum ScreenSize {
	XS = 'xs',
	SM = 'sm',
	MD = 'md',
	LG = 'lg',
	XL = 'xl',
	XXL = '2xl'
}

// Screen size breakpoints (Tailwind defaults)
const BREAKPOINTS = {
	SM: 640,
	MD: 768,
	LG: 1024,
	XL: 1280,
	XXL: 1536
} as const;

/**
 * Determines the current ScreenSize based on window width.
 * @param width The current window inner width.
 * @returns The corresponding ScreenSize enum value.
 */
function getScreenSizeName(width: number): ScreenSize {
	if (width < BREAKPOINTS.SM) {
		return ScreenSize.XS;
	} else if (width < BREAKPOINTS.MD) {
		return ScreenSize.SM;
	} else if (width < BREAKPOINTS.LG) {
		return ScreenSize.MD;
	} else if (width < BREAKPOINTS.XL) {
		return ScreenSize.LG;
	} else if (width < BREAKPOINTS.XXL) {
		return ScreenSize.XL;
	} else {
		return ScreenSize.XXL;
	}
}

/**
 * Manages reactive screen size state for the application.
 * Uses Svelte 5 runes for efficient and direct state management.
 */
class ScreenSizeStore {
	// Core reactive state properties using $state()
	// Initialize with sensible defaults for SSR, will be updated on client-side.
	width = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
	height = $state(typeof window !== 'undefined' ? window.innerHeight : 768);

	// Internal variable to hold the debounce timeout ID
	private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		// No direct initialization in constructor, relies on $effect.root for setup.
	}

	// --- Derived State ($derived) ---

	/**
	 * The current ScreenSize category (e.g., 'md', 'lg').
	 * Automatically updates when `width` changes.
	 */
	// FIX: Use $derived directly as a class field declaration
	currentSize = $derived(getScreenSizeName(this.width));

	/**
	 * True if the current screen size is mobile (XS or SM).
	 */
	isMobile = $derived(this.currentSize === ScreenSize.XS || this.currentSize === ScreenSize.SM);

	/**
	 * True if the current screen size is tablet (MD).
	 */
	isTablet = $derived(this.currentSize === ScreenSize.MD);

	/**
	 * True if the current screen size is desktop (LG, XL, or XXL).
	 */
	isDesktop = $derived(this.currentSize === ScreenSize.LG || this.currentSize === ScreenSize.XL || this.currentSize === ScreenSize.XXL);

	/**
	 * True if the current screen is a large desktop (XL or XXL).
	 */
	isLargeScreen = $derived(this.currentSize === ScreenSize.XL || this.currentSize === ScreenSize.XXL);

	// --- Internal Helper Methods ---

	/**
	 * Debounces a function call.
	 * @param fn The function to debounce.
	 * @param delay The debounce delay in milliseconds.
	 * @returns A debounced version of the function.
	 */
	private debounce(fn: () => void, delay: number): () => void {
		return () => {
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout);
			}
			this.resizeTimeout = setTimeout(fn, delay);
		};
	}

	/**
	 * Updates the internal `width` and `height` reactive states.
	 * Only updates `currentSize` if its category changes.
	 */
	private updateScreenSize = () => { // Use arrow function to bind 'this'
		if (typeof window !== 'undefined') {
			const newWidth = window.innerWidth;
			const newHeight = window.innerHeight;

			// Get previous size category BEFORE updating width, height
			// This access now reads the $derived property directly
			const prevSizeCategory = this.currentSize;

			// Update width and height directly. This will trigger currentSize to re-derive.
			this.width = newWidth;
			this.height = newHeight;

			// Check if the screen size CATEGORY has changed.
			// This check is now mostly for logging/optimization, as $derived will handle currentSize automatically.
			const newSizeCategory = this.currentSize; // this will be the newly derived value
			if (prevSizeCategory !== newSizeCategory) {
				console.debug('ScreenSizeStore: Screen size category changed to', newSizeCategory);
			}
		}
	};

	// --- Public Lifecycle Methods ---

	/**
	 * Sets up the resize event listener. This method is called by $effect.root.
	 * @returns A cleanup function to remove the event listener.
	 */
	public setupListener(): () => void {
		if (typeof window === 'undefined') {
			return () => {}; // Return a no-op function for SSR
		}

		const debouncedUpdate = this.debounce(this.updateScreenSize, 150);

		// Initial update on setup
		this.updateScreenSize();

		// Add event listener
		window.addEventListener('resize', debouncedUpdate);

		// Return cleanup function for $effect.root
		return () => {
			window.removeEventListener('resize', debouncedUpdate);
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout);
				this.resizeTimeout = null;
			}
		};
	}
}

// --- Global Store Instance ---
// Instantiate the single global screen size manager.
export const screenSizeStore = new ScreenSizeStore();

// --- Lifecycle Management for the Global Store ---
// Use $effect.root to manage initialization and cleanup for the global store.
// This ensures it runs once when the app starts (on client-side) and cleans up on unload.
$effect.root(() => {
	// The `setupListener` method returns a cleanup function, which $effect.root
	// will automatically call when its scope is destroyed (e.g., on page unload).
	const cleanup = screenSizeStore.setupListener();
	return cleanup; // This is the cleanup function for $effect.root
});

// --- Export individual reactive states for easier consumption ---
// Components can import these directly for reactivity.
export const screenWidth = screenSizeStore.width;
export const screenHeight = screenSizeStore.height;
export const screenSize = screenSizeStore.currentSize; // This is the derived property
export const isMobile = screenSizeStore.isMobile;
export const isTablet = screenSizeStore.isTablet;
export const isDesktop = screenSizeStore.isDesktop;
export const isLargeScreen = screenSizeStore.isLargeScreen;

// Export the helper function for direct use if needed outside the store logic
export { getScreenSizeName };
