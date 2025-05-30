/**
 * @file src/stores/UIStore.svelte.ts
 * @description Modern UI element visibility management with Svelte 5 runes
 *
 * Features:
 * - Native runes-based reactivity
 * - Responsive layout updates based on screen size and collection mode
 * - Clean initialization and cleanup
 * - Type-safe state management
 */

import { mode } from './collectionStore.svelte';
import { screenSize, ScreenSize } from './screenSizeStore.svelte';
// System Logger
import { logger } from '@utils/logger.svelte';

// Types for UI visibility states
export type UIVisibility = 'hidden' | 'collapsed' | 'full';

// Interface for UI state
export interface UIState {
	leftSidebar: UIVisibility;
	rightSidebar: UIVisibility;
	pageheader: UIVisibility;
	pagefooter: UIVisibility;
	header: UIVisibility;
	footer: UIVisibility;
}

// Get default state based on screen size and mode
function getDefaultState(size: ScreenSize, isViewMode: boolean): UIState {
	logger.debug('UIStore: Calculating default state', {
		screenSize: size,
		isViewMode
	});

	// Mobile behavior (<768px)
	if (size === ScreenSize.XS || size === ScreenSize.SM) {
		return {
			leftSidebar: 'hidden',
			rightSidebar: 'hidden',
			pageheader: isViewMode ? 'hidden' : 'full',
			pagefooter: isViewMode ? 'hidden' : 'full',
			header: 'hidden',
			footer: 'hidden'
		};
	}

	// Tablet behavior (768-1023px)
	if (size === ScreenSize.MD) {
		return {
			leftSidebar: isViewMode ? 'collapsed' : 'hidden',
			rightSidebar: 'hidden',
			pageheader: isViewMode ? 'hidden' : 'full',
			pagefooter: isViewMode ? 'hidden' : 'full',
			header: 'hidden',
			footer: 'hidden'
		};
	}

	// Desktop behavior (≥1024px)
	return {
		leftSidebar: isViewMode ? 'full' : 'collapsed',
		rightSidebar: isViewMode ? 'hidden' : 'full',
		pageheader: isViewMode ? 'hidden' : 'full',
		pagefooter: isViewMode ? 'hidden' : 'full',
		header: 'hidden',
		footer: 'hidden'
	};
}

// Create the UI state management system
function createUIState() {
	// Get current values from stores safely
	const getCurrentScreenSize = (): ScreenSize => {
		try {
			return screenSize.value || ScreenSize.LG;
		} catch (e) {
			return ScreenSize.LG; // Safe default
		}
	};

	const getCurrentMode = (): string => {
		try {
			return mode.value || 'edit';
		} catch (e) {
			return 'edit'; // Safe default
		}
	};

	// Initialize reactive state with safe defaults
	let userPreferred = $state('collapsed' as UIVisibility);
	let currentScreenSize = $state(getCurrentScreenSize());
	let currentMode = $state(getCurrentMode());

	// Derived state - computed reactively
	const isViewMode = $derived(currentMode === 'view' || currentMode === 'media');

	// UI state that updates when dependencies change
	const uiState = $derived(getDefaultState(currentScreenSize, isViewMode));

	// Derived visibility states
	const isLeftSidebarVisible = $derived(uiState.leftSidebar !== 'hidden');
	const isRightSidebarVisible = $derived(uiState.rightSidebar !== 'hidden');
	const isPageHeaderVisible = $derived(uiState.pageheader !== 'hidden');
	const isPageFooterVisible = $derived(uiState.pagefooter !== 'hidden');
	const isHeaderVisible = $derived(uiState.header !== 'hidden');
	const isFooterVisible = $derived(uiState.footer !== 'hidden');

	// Manual overrides for UI elements
	let manualOverrides = $state({} as Partial<UIState>);

	// Final UI state with manual overrides applied
	const finalUIState = $derived({
		...uiState,
		...manualOverrides
	});

	// Sync with external stores
	$effect(() => {
		try {
			const newScreenSize = screenSize.value;
			if (newScreenSize && newScreenSize !== currentScreenSize) {
				currentScreenSize = newScreenSize;
			}
		} catch (e) {
			// External store not ready
		}
	});

	$effect(() => {
		try {
			const newMode = mode.value;
			if (newMode && newMode !== currentMode) {
				currentMode = newMode;
			}
		} catch (e) {
			// External store not ready
		}
	});

	// Methods
	function toggleUIElement(element: keyof UIState, state: UIVisibility) {
		manualOverrides = {
			...manualOverrides,
			[element]: state
		};
	}

	function clearOverride(element: keyof UIState) {
		const { [element]: removed, ...rest } = manualOverrides;
		manualOverrides = rest;
	}

	function clearAllOverrides() {
		manualOverrides = {};
	}

	function updateLayout() {
		// Force sync with external stores
		try {
			currentScreenSize = screenSize.value || currentScreenSize;
			currentMode = mode.value || currentMode;
		} catch (e) {
			// External stores not ready
		}
	}

	function setUserPreferred(state: UIVisibility) {
		userPreferred = state;
	}

	return {
		// State access (read-only getters)
		get uiState() { return finalUIState; },
		get baseUIState() { return uiState; },
		get userPreferred() { return userPreferred; },
		get manualOverrides() { return manualOverrides; },

		// Derived visibility states
		get isLeftSidebarVisible() { return isLeftSidebarVisible; },
		get isRightSidebarVisible() { return isRightSidebarVisible; },
		get isPageHeaderVisible() { return isPageHeaderVisible; },
		get isPageFooterVisible() { return isPageFooterVisible; },
		get isHeaderVisible() { return isHeaderVisible; },
		get isFooterVisible() { return isFooterVisible; },

		// Methods
		toggleUIElement,
		clearOverride,
		clearAllOverrides,
		updateLayout,
		setUserPreferred
	};
}

// Create the singleton UI state manager
export const uiStateManager = createUIState();

// Export individual functions for convenience
export const toggleUIElement = uiStateManager.toggleUIElement;
export const handleUILayoutToggle = uiStateManager.updateLayout;

// Header controller state
const headerOptions = $state({
	showMore: false
});

// Centralized headerController for Widgets
export const headerController = {
	get options() {
		return headerOptions;
	},
	setShowMore(visible: boolean) {
		headerOptions.showMore = visible;
	}
};

// Export types
export type { UIState, UIVisibility };