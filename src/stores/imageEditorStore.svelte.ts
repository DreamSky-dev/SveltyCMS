/**
 * @file src/stores/imageEditorStore.svelte.ts
 * @description Manages the image editor using Svelte 5 runes
 *
 * This provides functionality to:
 * - Undo and redo actions in the image editor
 * - Add edit actions to the image editor
 * - Track image editor state
 * - Update image editor state reactively
 */

import type Konva from 'konva'; // Ensure Konva is installed and properly typed

// Types
export interface EditAction {
	undo: () => void;
	redo: () => void;
}

// Interface for the image editor's internal state
export interface ImageEditorState {
	file: File | null;
	saveEditedImage: boolean;
	editHistory: EditAction[];
	currentHistoryIndex: number;
	stage: Konva.Stage | null;
	layer: Konva.Layer | null;
	imageNode: Konva.Image | null;
}

/**
 * Manages the state and operations of the image editor.
 * Uses Svelte 5 runes ($state, $derived) for highly reactive and efficient state management.
 */
class ImageEditorStore {
	// Reactive state properties using $state()
	file = $state<File | null>(null);
	saveEditedImage = $state(false);
	editHistory = $state<EditAction[]>([]);
	currentHistoryIndex = $state(-1);
	stage = $state<Konva.Stage | null>(null);
	layer = $state<Konva.Layer | null>(null);
	imageNode = $state<Konva.Image | null>(null);

	constructor() {
		// No specific initialization logic needed in the constructor itself,
		// as $state variables are immediately reactive upon instantiation.
	}

	// Derived state properties using $derived() for computed values
	get canUndo(): boolean {
		return $derived(this.currentHistoryIndex >= 0);
	}

	get canRedo(): boolean {
		return $derived(this.currentHistoryIndex < this.editHistory.length - 1);
	}

	get hasActiveImage(): boolean {
		return $derived(!!this.file && !!this.imageNode);
	}

	// --- Public Methods to Mutate State ---

	/**
	 * Sets the file being edited.
	 * @param file The new file object or null.
	 */
	setFile(file: File | null) {
		this.file = file; // Direct assignment triggers reactivity
	}

	/**
	 * Sets the flag indicating whether the image should be saved after editing.
	 * @param value Boolean indicating whether to save.
	 */
	setSaveEditedImage(value: boolean) {
		this.saveEditedImage = value; // Direct assignment
	}

	/**
	 * Sets the Konva stage instance.
	 * @param stage The Konva.Stage object.
	 */
	setStage(stage: Konva.Stage) {
		this.stage = stage; // Direct assignment
	}

	/**
	 * Sets the Konva layer instance.
	 * @param layer The Konva.Layer object.
	 */
	setLayer(layer: Konva.Layer) {
		this.layer = layer; // Direct assignment
	}

	/**
	 * Sets the Konva image node instance.
	 * @param imageNode The Konva.Image object.
	 */
	setImageNode(imageNode: Konva.Image) {
		this.imageNode = imageNode; // Direct assignment
	}

	/**
	 * Adds an edit action to the history. Redoable actions are removed if a new action is added.
	 * @param action The EditAction object containing undo/redo functions.
	 */
	addEditAction(action: EditAction) {
		// Slice the history to remove any actions beyond the current index
		this.editHistory = this.editHistory.slice(0, this.currentHistoryIndex + 1);
		// Add the new action
		this.editHistory.push(action);
		// Update the index
		this.currentHistoryIndex = this.editHistory.length - 1;
		// Since we modified an array directly, we re-assign it to ensure reactivity.
		// Svelte 5 tracks array length/elements, but explicit re-assignment of the array reference
		// is robust if you're chaining methods or modifying its contents.
		// However, with push, pop, shift, unshift, splice, Svelte 5 automatically tracks the change.
		// The key here is that `editHistory` itself is a `$state` variable.
		// If you're using methods that modify the array *in place* (like push()),
		// Svelte 5 tracks this fine. The `slice` creates a new array, so that's also handled.
	}

	/**
	 * Performs the undo operation for the current action in history.
	 */
	undo() {
		if (this.currentHistoryIndex >= 0) {
			this.editHistory[this.currentHistoryIndex].undo();
			this.currentHistoryIndex--; // Direct assignment
		}
	}

	/**
	 * Performs the redo operation for the next action in history.
	 */
	redo() {
		if (this.currentHistoryIndex < this.editHistory.length - 1) {
			this.currentHistoryIndex++; // Increment index first
			this.editHistory[this.currentHistoryIndex].redo(); // Then perform action
		}
	}

	/**
	 * Clears the entire edit history.
	 */
	clearHistory() {
		this.editHistory = []; // Direct assignment
		this.currentHistoryIndex = -1; // Direct assignment
	}

	/**
	 * Resets the entire image editor state to its initial values.
	 */
	reset() {
		// Reset all $state properties to their initial values
		this.file = null;
		this.saveEditedImage = false;
		this.editHistory = [];
		this.currentHistoryIndex = -1;
		this.stage = null;
		this.layer = null;
		this.imageNode = null;
	}

	/**
	 * Provides a snapshot of the current internal state.
	 * This is primarily for debugging or situations where you need a single object.
	 */
	get currentState(): ImageEditorState {
		return $derived({
			file: this.file,
			saveEditedImage: this.saveEditedImage,
			editHistory: this.editHistory, // Note: This will be a reference to the array
			currentHistoryIndex: this.currentHistoryIndex,
			stage: this.stage,
			layer: this.layer,
			imageNode: this.imageNode
		});
	}
}

// Instantiate the single global image editor store
export const imageEditorStore = new ImageEditorStore();

// Export types for external use
export type { EditAction, ImageEditorState };
