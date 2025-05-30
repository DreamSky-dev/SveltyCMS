/**
 * @file src/stores/collectionStore.ts
 * @description Manages the collection state using Svelte 5 runes
 *
 * Features:
 * - Collection state management with Svelte 5 runes
 * - Asynchronous collection initialization
 * - Collection updating with reactive states
 * - TypeScript support with custom Collection type
 */

import type { Schema } from '@src/content/types';
import type { ContentNode } from '../databases/dbInterface';

// Define types
export type ModeType = 'view' | 'edit' | 'create' | 'delete' | 'modify' | 'media';

// Widget interface
interface Widget {
	permissions: Record<string, Record<string, boolean>>;
	[key: string]: Record<string, Record<string, boolean>> | unknown;
}

// Status map for various collection states
export const statusMap = {
	deleted: 'deleted',
	published: 'published',
	unpublished: 'unpublished',
	scheduled: 'scheduled',
	cloned: 'cloned',
	testing: 'testing'
} as const;

/**
 * Manages the application's collection state using Svelte 5 runes.
 * Provides reactive properties and methods for managing collections,
 * selected entries, and UI modes.
 */
class CollectionStore {
	// --- Core Reactive State ($state) ---
	// Using empty object/Map for initial state as provided in previous versions.
	collections = $state<{ [uuid: string]: Schema }>({});
	collectionsById = $state<Map<string, Schema>>(new Map());
	currentCollectionId = $state<string | null>(null);

	collectionsLoading = $state(false);
	collectionsError = $state<string | null>(null);
	unAssigned = $state<Schema>({} as Schema); // Consider providing a more robust initial empty Schema
	collection = $state<Schema | null>(null); // Initialize as null, will be set later
	collectionValue = $state<Record<string, unknown>>({});
	mode = $state<ModeType>('view');
	selectedEntries = $state<string[]>([]);
	targetWidget = $state<Widget>({ permissions: {} });
	contentStructure = $state<ContentNode[]>([]);

	constructor() {
		// No specific constructor logic needed for this store's $state variables.
	}

	// --- Methods for Core State Mutation ---

	/**
	 * Sets the entire collections map.
	 * @param newCollections A map of UUIDs to Schema objects.
	 */
	setCollections(newCollections: { [uuid: string]: Schema }) {
		this.collections = newCollections;
		// Also update collectionsById for consistency
		this.collectionsById = new Map(Object.entries(newCollections));
	}

	/**
	 * Sets the currently active collection ID.
	 * @param id The UUID of the current collection, or null.
	 */
	setCurrentCollectionId(id: string | null) {
		this.currentCollectionId = id;
		// Automatically set the `collection` when `currentCollectionId` changes
		this.collection = id ? this.collectionsById.get(id) ?? null : null;
	}

	/**
	 * Sets the loading state for collections.
	 * @param loading True if collections are loading, false otherwise.
	 */
	setCollectionsLoading(loading: boolean) {
		this.collectionsLoading = loading;
	}

	/**
	 * Sets an error message related to collections.
	 * @param error The error message string, or null.
	 */
	setCollectionsError(error: string | null) {
		this.collectionsError = error;
	}

	/**
	 * Sets the unassigned schema.
	 * @param schema The unassigned schema object.
	 */
	setUnAssigned(schema: Schema) {
		this.unAssigned = schema;
	}

	/**
	 * Sets the current collection schema object directly.
	 * @param schema The current collection schema, or null.
	 */
	setCollection(schema: Schema | null) {
		this.collection = schema;
		// If setting the collection directly, ensure currentCollectionId is in sync
		this.currentCollectionId = schema?._id ?? null;
	}

	/**
	 * Sets the current collection's value data.
	 * @param value A record of string keys to unknown values.
	 */
	setCollectionValue(value: Record<string, unknown>) {
		this.collectionValue = value;
	}

	/**
	 * Sets the current UI mode.
	 * @param mode The new ModeType.
	 */
	setMode(mode: ModeType) {
		this.mode = mode;
	}

	/**
	 * Sets the currently targeted widget.
	 * @param widget The target Widget object.
	 */
	setTargetWidget(widget: Widget) {
		this.targetWidget = widget;
	}

	/**
	 * Sets the content structure.
	 * @param structure An array of ContentNode objects.
	 */
	setContentStructure(structure: ContentNode[]) {
		this.contentStructure = structure;
	}

	// --- Derived State ($derived) ---

	// FIX: These are now direct class fields using $derived
	totalCollections = $derived(Object.keys(this.collections).length);
	hasSelectedEntries = $derived(this.selectedEntries.length > 0);
	currentCollectionName = $derived(this.collection?.name);

	// --- Entry Management Methods ---

	/**
	 * Adds an entry ID to the list of selected entries.
	 * @param entryId The ID of the entry to add.
	 */
	addEntry(entryId: string) {
		// Create a new array reference to ensure reactivity
		this.selectedEntries = [...this.selectedEntries, entryId];
	}

	/**
	 * Removes an entry ID from the list of selected entries.
	 * @param entryId The ID of the entry to remove.
	 */
	removeEntry(entryId: string) {
		// Create a new array reference to ensure reactivity
		this.selectedEntries = this.selectedEntries.filter((id) => id !== entryId);
	}

	/**
	 * Clears all selected entries.
	 */
	clearSelectedEntries() {
		this.selectedEntries = []; // Direct assignment to empty array
	}

	// --- Async Actions (example for modifyEntry) ---

	/**
	 * Placeholder function for modifying an entry's status.
	 * This would typically involve an API call.
	 * @param status The new status for the entry (optional).
	 * @returns A Promise that resolves when the modification is complete.
	 */
	async modifyEntry(status?: keyof typeof statusMap): Promise<void> {
		// Example: Simulate an async operation
		this.collectionsLoading = true;
		this.collectionsError = null;
		try {
			console.log(`Modifying entry with status: ${status ?? 'N/A'}`);
			await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API delay
			// Update local state after successful operation
			// e.g., if you were modifying a specific entry in 'collections'
			console.log('Entry modified successfully (simulated).');
		} catch (error) {
			this.collectionsError = error instanceof Error ? error.message : 'Failed to modify entry';
			console.error('Modify entry error:', error);
			throw error; // Re-throw to allow upstream error handling
		} finally {
			this.collectionsLoading = false;
		}
	}
}

// Instantiate the single global collection store
export const collectionStore = new CollectionStore();

// --- Exported Helper for Entry Actions (optional, can be accessed directly from collectionStore) ---
// This pattern might be useful if you want to destructure or pass just these methods around.
// Otherwise, direct access via `collectionStore.addEntry()` is perfectly fine.
export const entryActions = {
	addEntry: collectionStore.addEntry.bind(collectionStore),
	removeEntry: collectionStore.removeEntry.bind(collectionStore),
	clear: collectionStore.clearSelectedEntries.bind(collectionStore)
};

// --- Exported Aliases for Convenience (optional) ---
// These are just re-exports of methods/properties from the main collectionStore instance
// for easier import if desired.
export const {
	collections,
	collectionsById,
	currentCollectionId,
	collectionsLoading,
	collectionsError,
	unAssigned,
	collection,
	collectionValue,
	mode,
	selectedEntries,
	targetWidget,
	contentStructure,
	// The derived properties (totalCollections, hasSelectedEntries, currentCollectionName)
	// are now direct properties of `collectionStore`.
	// If you want to export them for direct import, do so as:
	// totalCollections: collectionStore.totalCollections,
	// hasSelectedEntries: collectionStore.hasSelectedEntries,
	// currentCollectionName: collectionStore.currentCollectionName,
	// But it's often cleaner to import `collectionStore` and access them as `collectionStore.totalCollections`.
	setCollections,
	setCurrentCollectionId,
	setCollectionsLoading,
	setCollectionsError,
	setUnAssigned,
	setCollection,
	setCollectionValue,
	setMode,
	setTargetWidget,
	setContentStructure,
	modifyEntry // Re-exporting the async method
} = collectionStore;


// Type exports
export type { ModeType };
