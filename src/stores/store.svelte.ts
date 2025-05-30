/**
 * @file src/stores/store.svelte.ts
 * @description Global state management
 *
 * This module manages:
 * - System and content languages
 * - Internationalization messages
 * - UI state and components
 * - Validation and loading states
 */

import { publicEnv } from '@root/config/public';
import { setLanguageTag, type AvailableLanguageTag } from '@src/paraglide/runtime';
import * as m from '@src/paraglide/messages';

// Helper to get cookie value
function getCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
	return null;
}

// Interfaces
interface ValidationErrors {
	[fieldName: string]: string | null;
}

interface SaveFunction {
	fn: (args?: unknown) => unknown;
	reset: () => void;
}

export interface TranslationSet {
	total: Set<string>;
	translated: Set<string>;
}

export type TranslationProgress = {
	[key in AvailableLanguageTag]?: TranslationSet;
} & {
	show: boolean;
};

// Initial language setup from cookies or environment defaults
const initialSystemLanguage = (getCookie('systemLanguage') as AvailableLanguageTag | null) ?? publicEnv.DEFAULT_SYSTEM_LANGUAGE;
const initialContentLanguage = (getCookie('contentLanguage') as AvailableLanguageTag | null) ?? publicEnv.DEFAULT_CONTENT_LANGUAGE;

/**
 * Core Svelte store using Svelte 5 runes for enhanced reactivity.
 * All state is managed directly with `$state` for optimal performance.
 */
class AppStore {
	// Language and i18n
	systemLanguage = $state<AvailableLanguageTag>(initialSystemLanguage as AvailableLanguageTag);
	contentLanguage = $state<AvailableLanguageTag>(initialContentLanguage as AvailableLanguageTag);
	messages = $state({ ...m });

	// Translation status
	translationStatus = $state({});
	completionStatus = $state(0);
	translationStatusOpen = $state(false);
	translationProgress = $state<TranslationProgress>(this.initializeTranslationProgress());

	// UI state
	tabSet = $state(0);
	headerActionButton = $state<ConstructorOfATypedSvelteComponent | string | undefined>(undefined);
	headerActionButton2 = $state<ConstructorOfATypedSvelteComponent | string | undefined>(undefined);
	pkgBgColor = $state('variant-filled-primary');
	drawerExpanded = $state(true);
	storeListboxValue = $state('create');

	// Loading state
	loadingProgress = $state(0);
	isLoading = $state(false);

	// Image handling
	avatarSrc = $state('/Default_User.svg');
	file = $state<File | null>(null);
	saveEditedImage = $state(false);

	// Save functionality
	saveFunction = $state<SaveFunction>({ fn: () => {}, reset: () => {} });
	saveLayerStore = $state(async () => {});
	shouldShowNextButton = $state(false);

	// Validation state
	validationErrors: ValidationErrors = $state({});

	// FIX: Declare isValid directly as a $derived property, not inside a getter
	isValid = $derived(Object.values(this.validationErrors).every((error) => !error));

	constructor() {
		// Reactions for language changes to update cookies and ParaglideJS
		$effect(() => {
			if (typeof window !== 'undefined' && this.systemLanguage) {
				document.cookie = `systemLanguage=${this.systemLanguage}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
				setLanguageTag(this.systemLanguage);
				this.messages = { ...m }; // Re-assign to trigger reactivity
			}
		});

		$effect(() => {
			if (typeof window !== 'undefined' && this.contentLanguage) {
				document.cookie = `contentLanguage=${this.contentLanguage}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
				setLanguageTag(this.contentLanguage); // Potentially set content language for ParaglideJS too, if needed for client-side content rendering
				this.messages = { ...m }; // Re-assign to trigger reactivity
			}
		});
	}

	// Method to initialize translation progress for all available languages
	private initializeTranslationProgress(): TranslationProgress {
		const initialProgress: TranslationProgress = { show: false };
		for (const lang of publicEnv.AVAILABLE_CONTENT_LANGUAGES as AvailableLanguageTag[]) {
			initialProgress[lang] = {
				total: new Set<string>(),
				translated: new Set<string>()
			};
		}
		return initialProgress;
	}

	// --- Validation Methods (fully integrated with $state) ---
	setValidationError(fieldName: string, errorMessage: string | null) {
		if (errorMessage) {
			this.validationErrors = { ...this.validationErrors, [fieldName]: errorMessage };
		} else {
			const newErrors = { ...this.validationErrors };
			delete newErrors[fieldName];
			this.validationErrors = newErrors;
		}
	}

	clearError(fieldName: string) {
		const newErrors = { ...this.validationErrors };
		delete newErrors[fieldName];
		this.validationErrors = newErrors;
	}

	clearAllValidationErrors() {
		this.validationErrors = {};
	}

	getError(fieldName: string): string | null {
		return this.validationErrors[fieldName] || null;
	}

	hasError(fieldName: string): boolean {
		return !!this.validationErrors[fieldName];
	}

	// --- Translation Progress Methods (fully integrated with $state) ---
	updateTranslationFieldStatus(
		fieldName: string,
		language: AvailableLanguageTag,
		isTranslated: boolean,
		isTranslatable: boolean
	) {
		// Ensure the language entry exists
		if (!this.translationProgress[language]) {
			this.translationProgress[language] = { total: new Set(), translated: new Set() };
		}

		const langProgress = this.translationProgress[language]!; // Non-null assertion after check

		if (isTranslatable) {
			langProgress.total.add(fieldName); // Always add to total if translatable
		} else {
			langProgress.total.delete(fieldName); // Remove if no longer translatable
		}

		if (isTranslated) {
			langProgress.translated.add(fieldName);
		} else {
			langProgress.translated.delete(fieldName);
		}

		// Recalculate 'show' based on current state
		let totalFields = 0;
		for (const lang of publicEnv.AVAILABLE_CONTENT_LANGUAGES as AvailableLanguageTag[]) {
			if (this.translationProgress[lang]?.total) {
				totalFields += this.translationProgress[lang]!.total.size;
			}
		}
		this.translationProgress.show = totalFields > 0;

		// Re-assign translationProgress to trigger reactivity for the whole object
		// This is important because modifying Sets directly doesn't trigger reactivity
		// by changing the object reference. A shallow copy ensures Svelte detects the change.
		this.translationProgress = { ...this.translationProgress };
	}
}

// Instantiate the single global store
export const appStore = new AppStore();

// Export table headers constant
export const tableHeaders = ['id', 'email', 'username', 'role', 'createdAt'] as const;

// Export indexer (consider if this is still needed or can be integrated)
export const indexer = undefined;
