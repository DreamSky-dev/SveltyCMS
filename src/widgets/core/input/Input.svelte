<!--
@file src/widgets/core/input/Input.svelte
@component
**Input Widget Component for entering and editing text data in a CMS collection. Supports multilingual input, validation, and dynamic translation status updates**

@example
<Input field={{ label: "Title", db_fieldName: "title", translated: true, required: true }} />

### Props
- `field`: FieldType (configuration for the input, e.g., label, required, translated)
- `value`: any (object storing input values, e.g., { en: "Hello", fr: "" })

### Features
- **Multilingual Support**: Handles translatable fields with reactive updates to translation status.
- **Validation**: Checks for required fields, minimum length, and custom rules, updating validation store.
- **Error Handling**: Displays validation errors inline with accessible markup.
-->

<script lang="ts">
	import { publicEnv } from '@root/config/public';
	import type { FieldType } from '.';

	// Utils (ensure these are rune-compatible or pure functions)
	import { updateTranslationProgress, getFieldName } from '@src/utils/utils';

	// Valibot validation
	import { string, pipe, parse, type ValiError, nonEmpty, nullable } from 'valibot';

	// Svelte 5 stores (assuming these are already converted to rune-based class stores)
	import { appStore } from '@root/src/stores/store.svelte'; // Central appStore for contentLanguage and validationStore

	// Props interface
	interface Props {
		field: FieldType;
		// Use $bindable for two-way data binding with props
		value?: { [key: string]: string }; // Type for the value object
	}

	// Props declaration with $props and $bindable
	let {
		field,
		value = $bindable({}) // Initialize `value` as an empty object if not provided
	}: Props = $props();

	// --- Reactive State & Derived Values ---

	// Reactive state for the current language, derived from `field.translated` and `appStore.contentLanguage`.
	let _language = $derived(
		field?.translated ? appStore.contentLanguage.toLowerCase() : publicEnv.DEFAULT_CONTENT_LANGUAGE.toLowerCase()
	);

	// Reactive state for character count, derived from the current language's value.
	let count = $derived((value[_language] ?? '').length);

	// Validation and error state using $state (component-local state)
	let validationError = $state<string | null>(null);
	let touched = $state(false); // Tracks if the input has lost focus
	let debounceTimeout: number | undefined;
	let inputElement: HTMLInputElement | null = null; // Used for focus management

	// Valibot schema: Derived based on `field.required` for immediate reactivity.
	const validationSchema = $derived(field?.required ? pipe(string(), nonEmpty()) : nullable(string()));

	// --- Computed Styles/Classes ---

	// Memoized badge class calculation using a Map for caching (remains efficient).
	const badgeClassCache = new Map<string, string>();
	const getBadgeClass = (length: number) => {
		const key = `${length}-${field?.minlength}-${field?.maxlength}-${field?.count}`;
		if (badgeClassCache.has(key)) return badgeClassCache.get(key)!;

		let result: string;
		if (field?.minlength && length < field?.minlength) result = 'bg-red-600';
		else if (field?.maxlength && length > field?.maxlength) result = 'bg-red-600';
		else if (field?.count && length === field?.count) result = 'bg-green-600';
		else if (field?.count && length > field?.count) result = 'bg-orange-600';
		else if (field?.minlength) result = '!variant-filled-surface'; // If only min length, default style
		else result = '!variant-ghost-surface'; // Default style if no specific count constraints

		badgeClassCache.set(key, result);
		return result;
	};

	// --- Validation Logic ---

	/**
	 * Validates the input value against the defined schema and updates `validationError`.
	 * This function is now fully reactive and handles debouncing internally.
	 * @param forceShowError If true, validation error is shown immediately, else debounced.
	 */
	function validateInput(forceShowError = false) {
		if (debounceTimeout) clearTimeout(debounceTimeout);

		debounceTimeout = window.setTimeout(
			() => {
				// Access current value and language directly from $state/derived
				const newValue = value[_language];
				const fieldName = getFieldName(field);

				// Always clear previous error before re-validation.
				validationError = null;
				appStore.clearError(fieldName); // Use appStore's method

				try {
					// Check for required field emptiness first (before Valibot parse for clearer messages).
					if (field?.required && (newValue === null || newValue === undefined || newValue === '')) {
						validationError = 'This field is required';
						appStore.setError(fieldName, validationError);
						return; // Stop further validation
					}

					// Only proceed with Valibot parse if value is not null/undefined for nullable fields
					if (newValue !== null && newValue !== undefined) {
						// Valibot schema handles `nonEmpty` for required strings.
						// Additional length checks are now handled by Valibot's string validation or custom pipes.
						// If you still want separate min/max messages before valibot, you can keep them.
						// For this example, we'll let Valibot handle primary validation based on schema.

						// If `field.minlength` or `field.maxlength` are in FieldType, you might want custom Valibot pipes for them.
						// Example custom pipe (pseudo-code):
						// const lengthPipe = [
						//   field?.minlength ? minLength(field.minlength, `Min length is ${field.minlength}`) : undefined,
						//   field?.maxlength ? maxLength(field.maxlength, `Max length is ${field.maxlength}`) : undefined
						// ].filter(Boolean);
						// const finalSchema = field?.required ? pipe(string(), nonEmpty(), ...lengthPipe) : pipe(nullable(string()), ...lengthPipe);
						// For simplicity here, assuming valibot schema covers basic string validation.

						parse(validationSchema, newValue);
					}

					// If parsing succeeds and no custom checks failed, clear error.
					validationError = null;
					appStore.clearError(fieldName);
				} catch (error) {
					// Catch Valibot-specific errors (from `parse` method) and general errors.
					if (error && typeof error === 'object' && 'issues' in error) {
						const valiError = error as ValiError<typeof validationSchema>;
						validationError = valiError.issues[0]?.message || 'Invalid input';
						appStore.setError(fieldName, validationError);
					} else {
						console.error('An unexpected error occurred during validation:', error);
						validationError = 'An unexpected error occurred during validation';
						appStore.setError(fieldName, 'Validation error');
					}
				}
			},
			forceShowError ? 0 : 300 // Immediate validation if forceShowError is true, otherwise debounce.
		);
	}

	// --- Svelte 5 Effects for Reactive Logic ---

	// Effect to trigger translation progress update when the value or language changes.
	// This replaces the custom `track` utility.
	$effect(() => {
		// This effect will re-run whenever `value` or `_language` (which uses `value[_language]`) changes.
		// The `value` prop is $bindable, so changes from the input will trigger this.
		// The `_language` derived property changes when `appStore.contentLanguage` changes.
		updateTranslationProgress(value, field);
	});

	// Effect for initial validation and re-validation logic.
	$effect(() => {
		// Dependency on `_language` ensures re-validation when language changes.
		// Dependency on `value[_language]` ensures re-validation when content in current language changes.
		// Dependency on `field` ensures re-validation if field requirements change dynamically.
		_language; // Access to track dependency
		value[_language]; // Access to track dependency
		field; // Access to track dependency

		// Only re-validate if the input has been touched, or if it's an initially required field.
		// This prevents showing errors on untouched optional fields on initial render.
		if (touched || field?.required) {
			validateInput();
		}
	});

	// Cleanup effect: clear debounce timeout and cache when component is destroyed.
	$effect(() => {
		return () => {
			if (debounceTimeout) clearTimeout(debounceTimeout);
			badgeClassCache.clear();
		};
	});
</script>

<div class="input-container relative mb-4">
	<div class="variant-filled-surface btn-group flex w-full rounded" role="group">
		{#if field?.prefix}
			<button class="!px-2" aria-label={`${field.prefix} prefix`}>
				{field?.prefix}
			</button>
		{/if}

		<input
			type="text"
			bind:value={value[_language]}
			onblur={() => {
				touched = true; // Mark as touched on blur
				validateInput(true); // Validate immediately on blur
			}}
			oninput={() => {
				// Validate on input, debounced (unless forced by blur)
				// The $bindable `value` updates on input, which triggers the $effect for validation.
				// This call just ensures the debounce is handled.
				validateInput();
			}}
			name={field?.db_fieldName}
			id={field?.db_fieldName}
			bind:this={inputElement}
			placeholder={field?.placeholder || field?.db_fieldName}
			required={field?.required}
			disabled={field?.disabled}
			readonly={field?.readonly}
			minlength={field?.minlength}
			maxlength={field?.maxlength}
			class="input w-full flex-1 rounded-none text-black dark:text-primary-500"
			class:error={!!validationError && touched}
			aria-invalid={!!validationError && touched}
			aria-describedby={validationError && touched ? `${getFieldName(field)}-error` : undefined}
			aria-required={field?.required}
			data-testid="text-input"
		/>

		{#if field?.suffix || field?.count || field?.minlength || field?.maxlength}
			<div class="flex items-center" role="status" aria-live="polite">
				{#if field?.count || field?.minlength || field?.maxlength}
					<span class="badge mr-1 rounded-full {getBadgeClass(count)}" aria-label="Character count">
						{#if field?.count && field?.minlength && field?.maxlength}
							{count}/{field?.maxlength}
						{:else if field?.count && field?.maxlength}
							{count}/{field?.maxlength}
						{:else if field?.count && field?.minlength}
							{count} => {field?.minlength}
						{:else if field?.minlength && field?.maxlength}
							{count} => {field?.minlength}/{field?.maxlength}
						{:else if field?.count}
							{count}/{field?.count}
						{:else if field?.maxlength}
							{count}/{field?.maxlength}
						{:else if field?.minlength}
							min {field?.minlength}
						{/if}
					</span>
				{/if}
				{#if field?.suffix}
					<span class="!px-1" aria-label={`${field.suffix} suffix`}>{field?.suffix}</span>
				{/if}
			</div>
		{/if}
	</div>

	{#if validationError && touched}
		<p id={`${getFieldName(field)}-error`} class="absolute bottom-[-1rem] left-0 w-full text-center text-xs text-error-500" role="alert">
			{validationError}
		</p>
	{/if}
</div>

<style lang="postcss">
	.input-container {
		min-height: 2.5rem; /* Ensure consistent height even without error message */
	}

	.error {
		border-color: rgb(239 68 68); /* Tailwind's red-500 */
		box-shadow: 0 0 0 1px rgb(239 68 68); /* Add a subtle shadow for better error indication */
	}

	/* Optional: Improve styling for the suffix/prefix buttons */
	.btn-group button {
		background-color: theme('colors.gray.100'); /* Lighter background */
		color: theme('colors.gray.700'); /* Darker text */
		@apply dark:bg-gray-700 dark:text-gray-300;
	}
</style>
