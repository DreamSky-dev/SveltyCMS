// src/widgets/widgetManager.svelte.ts
/**
 * @file src/widgets/widgetManager.svelte.ts
 * @description Widget Manager for handling widget loading, activation, and configuration
 */

import { mount } from 'svelte';
import MissingWidget from './MissingWidget.svelte';
import type { Widget, WidgetId, WidgetFunction as OriginalWidgetFunction } from './types'; // Alias OriginalWidgetFunction
import type { User } from '@src/auth/types';
import type { Schema } from '../content/types';

// System Logger
import { logger } from '@utils/logger.svelte';

// Import reactive stores and initialization function from index.ts
import { initializeWidgets, widgetFunctions, activeWidgetList } from './index';

export type WidgetStatus = 'active' | 'inactive';

// Extend WidgetFunction from types.ts to include specifics if needed, though the original definition seems sufficient for its purpose as a function that returns a WidgetPlaceholder
export type WidgetFunction = OriginalWidgetFunction & {
	__widgetId?: string;
	Name: string;
	GuiSchema?: unknown;
	GraphqlSchema?: unknown;
	Icon?: string;
	Description?: string;
	aggregations?: unknown;
};

// The `widgets` map should ideally be derived from `widgetFunctions` or used internally if needed.
// For now, commenting out the direct export and direct mutation, as `widgetFunctions` from `index.ts` is the source of truth.
// const widgets = new Map<string, Widget>();
// export default widgets;

// Type definition for parameters passed to `modifyRequest` methods of widgets
export type ModifyRequestParams = {
	collection: Schema;
	id?: WidgetId;
	field: unknown; // This should be more specific, potentially FieldType from the widget
	data: { get: () => unknown; update: (newData: unknown) => void };
	user: User;
	type: 'GET' | 'POST' | 'DELETE' | 'PATCH';
	meta_data?: Record<string, unknown>;
};

// Resolves a widget placeholder into a fully functional `Widget` object. It checks if the widget is active and, if not, provides a `MissingWidget` component
export async function resolveWidgetPlaceholder(placeholder: {
	__widgetId: string;
	__widgetName: string;
	__widgetConfig: Record<string, unknown>;
}): Promise<Widget> {
	// Ensure widgets are initialized before attempting to resolve.
	await initializeWidgets();

	// Check if the widget is in the active list.
	const isActive = activeWidgetList.get().has(placeholder.__widgetName);
	if (!isActive) {
		logger.warn(`Widget "${placeholder.__widgetName}" (ID: ${placeholder.__widgetId}) is inactive or not found. Rendering MissingWidget.`);
		return {
			__widgetId: placeholder.__widgetId,
			Name: placeholder.__widgetName,
			// When rendering a Svelte component, directly return its constructor or a mounted instance.
			// If `MissingWidget` is a regular Svelte component, you'd typically import it and use it directly in a `<svelte:component>` tag.
			// If `mount` is used, it should be done in a place where the component is actually rendered into the DOM.
			// For a CMS, you often pass the component constructor and let the rendering framework handle mounting
			component: MissingWidget, // Pass the component constructor, not a mounted instance here
			config: placeholder.__widgetConfig
		};
	}

	// Find the widget function using its unique ID
	const widgetFn = Array.from(widgetFunctions.get().values()).find((widget) => widget.__widgetId === placeholder.__widgetId);

	if (!widgetFn) {
		logger.error(`Widget function with ID ${placeholder.__widgetId} not found for widget name "${placeholder.__widgetName}".`);
		// Fallback to MissingWidget if the function isn't found despite being in the active list
		return {
			__widgetId: placeholder.__widgetId,
			Name: placeholder.__widgetName,
			component: MissingWidget,
			config: placeholder.__widgetConfig
		};
	}

	// Call the widget function with its configuration to get the actual `Widget` instance
	return widgetFn(placeholder.__widgetConfig);
}

// Checks if a widget is available (loaded and active)
export function isWidgetAvailable(widgetName: string): boolean {
	// Check if the widget function exists AND if it's in the active list.
	const widgetFn = widgetFunctions.get().has(widgetName);
	const isActive = activeWidgetList.get().has(widgetName);
	return widgetFn && isActive;
}

// Returns a read-only map of all currently loaded widget functions
export function getWidgets(): ReadonlyMap<string, WidgetFunction> {
	return widgetFunctions.get();
}

// Returns a read-only set of names of all currently active widgets
export function getActiveWidgets(): ReadonlySet<string> {
	return activeWidgetList.get();
}

// Updates the activation status of a widget in the database and the client-side store
export async function updateWidgetStatus(widgetName: string, status: WidgetStatus): Promise<void> {
	try {
		// Mock database update. Replace with actual database interaction.
		// const { updateWidgetStatusInDatabase } = await import('../databases/dbInterface');
		// await updateWidgetStatusInDatabase(widgetName, status === 'active');

		// Optimistically update the active widget list in the store.
		// Use `activeWidgetList.update` for proper store updates
		activeWidgetList.update((currentList) => {
			const newList = new Set(currentList); // Create a new set to ensure reactivity
			if (status === 'active') {
				newList.add(widgetName);
			} else {
				newList.delete(widgetName);
			}
			return newList;
		});

		logger.info(`Widget ${widgetName} status updated to '${status}' successfully.`);
	} catch (error) {
		logger.error(`Error updating widget status for ${widgetName}:`, error);
		throw error;
	}
}

// Retrieves the configuration for a specific widget
export function getWidgetConfig(widgetName: string): Record<string, unknown> | undefined {
	const widget = widgetFunctions.get().get(widgetName);
	// Call the widget function with an empty object to get its default/initial config.
	return widget ? widget({}).config : undefined;
}

// Updates the configuration of a specific widget in the client-side store
export async function updateWidgetConfig(widgetName: string, config: Record<string, unknown>): Promise<void> {
	const widgetFn = widgetFunctions.get().get(widgetName);
	if (!widgetFn) {
		logger.warn(`Attempted to update config for non-existent widget: ${widgetName}`);
		return;
	}

	// Create a new `WidgetFunction` that returns a widget with updated config
	widgetFunctions.update((currentMap) => {
		const newMap = new Map(currentMap); // Create a new map for reactivity
		const originalWidgetInstance = widgetFn({}); // Get current widget instance to merge config
		const updatedWidgetFn: WidgetFunction = Object.assign((cfg: Record<string, unknown>) => {
			return {
				...originalWidgetInstance,
				config: { ...originalWidgetInstance.config, ...cfg } // Merge new config with existing
			};
		}, widgetFn); // Copy over properties from the original function like Name, __widgetId, etc.

		newMap.set(widgetName, updatedWidgetFn);
		return newMap;
	});

	logger.info(`Widget ${widgetName} configuration updated.`);
	// You might also want to persist this configuration to the database here.
}

// Loads and returns all active widget instances
export async function loadWidgets(): Promise<Map<string, Widget>> {
	await initializeWidgets(); // Ensure all widgets are initialized and active status is loaded.
	const widgetsMap = new Map<string, Widget>();

	// Get the current values from the reactive stores using `.get()`.
	const currentWidgetFunctions = widgetFunctions.get();
	const currentActiveWidgetList = activeWidgetList.get();

	for (const [name, widgetFn] of currentWidgetFunctions.entries()) {
		if (currentActiveWidgetList.has(name)) {
			// Call the widget function with an empty config or default config if available.
			widgetsMap.set(name, widgetFn({}));
		}
	}
	return widgetsMap;
}

// HMR setup for this file. It ensures the `initializeWidgets` from `index.ts` is triggered if `widgetManager` itself changes, potentially re-evaluating dependencies
if (import.meta.hot) {
	import.meta.hot.accept(() => {
		logger.info('Widget Manager module reloaded due to file changes.');
	});
}
