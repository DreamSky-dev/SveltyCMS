<!--
@file src/components/Fields.svelte
@component
**Fields component that renders collection fields to enter/edit & display data per language revision management, live preview, and API data display**

@example
<Fields />

### Props
- `fields` {NonNullable<typeof collection.value>['fields']} - Collection fields
- `ariaInvalid` {boolean} - Aria-invalid attribute for accessibility
- `ariaDescribedby` {string} - Aria-describedby attribute for accessibility

### Features
- Dynamic field rendering based on collection schema
- Tab-based interface for different views (Edit, Revision, Live Preview, API)
- Real-time translation progress updates
- Permission-based field filtering
- Integration with various widget types
-->

<script lang="ts">
	import { dev } from '$app/environment';
	import { publicEnv } from '@root/config/public';
	import { getFieldName } from '@utils/utils';

	// Auth
	import { page } from '$app/state';
	import type { RolePermissions } from '@src/auth/types';

	// Stores - Using Svelte 5 rune access
	import { contentLanguage, translationProgress, validationStore } from '@stores/store.svelte';
	import { collection, collectionValue } from '@src/stores/collectionStore.svelte';

	// ParaglideJS
	import * as m from '@src/paraglide/messages';

	// Skeleton - Ensure these are correctly imported and used
	import { TabGroup, Tab, CodeBlock, clipboard } from '@skeletonlabs/skeleton';

	// Components
	import { widgetFunctions } from '@src/widgets'; // Import the new store
	import Loading from '@components/Loading.svelte';
	import type { WidgetFunction } from '@src/widgets/types'; // Import WidgetFunction type

	// Props - using $props() rune for better type safety and reactivity
	interface Props {
		fields?: NonNullable<typeof collection.value>['fields'] | undefined;
		root?: boolean;
		fieldsData?: Record<string, any>;
		customData?: Record<string, any>; // Not directly used in the example, but good to keep
		value?: any; // Not directly used in the example, but good to keep
		// Removed ariaInvalid and ariaDescribedby props from here, as individual widgets handle their own ARIA
	}
	let { fields = undefined }: Props = $props();

	// Local state with $state() rune
	let apiUrl = $state('');
	let isLoading = $state(true);
	let tabSet = $state(0); // For tab group selection

	// Derived state with $derived.by() rune
	// `derivedFields` ensures we always work with the most up-to-date fields array.
	let derivedFields = $derived.by(() => {
		return fields || (collection.value?.fields ?? []);
	});

	// Initialize `currentCollectionValue`
	// This function now uses the `collectionValue.value` from the store directly
	// to ensure it's reactive to external changes to the collection's data.
	let currentCollectionValue = $state(getDefaultCollectionValue());

	function getDefaultCollectionValue() {
		const tempCollectionValue: Record<string, any> = {};
		const currentFields = fields || (collection.value?.fields ?? []);
		for (const field of currentFields) {
			const fieldName = getFieldName(field, true);
			tempCollectionValue[fieldName] = collectionValue.value ? (collectionValue.value[fieldName] ?? {}) : {};
		}
		return tempCollectionValue;
	}

	// Dynamic import of widget components
	// Using `import.meta.glob` with `eager: true` for pre-loading components.
	const modules: Record<string, { default: typeof SvelteComponent }> = import.meta.glob('@widgets/**/*.svelte', {
		eager: true
	});

	// Lifecycle $effect for initial loading state and console logging.
	$effect(() => {
		isLoading = false;
		console.log('Fields component initialized with fields:', derivedFields);
	});

	// Reactive statement for API URL generation.
	// Uses $effect to react to changes in `collection.value` and `collectionValue.value`.
	$effect(() => {
		if (!collection.value || !collectionValue.value) return; // Ensure both are available
		const id = collectionValue.value._id;
		const collectionName = collection.value._id; // Using _id as collection name for API path
		const currentApiUrl = `${dev ? 'http://localhost:5173' : publicEnv.SITE_NAME}/api/collection/${String(collectionName)}/${id}`;
		if (apiUrl !== currentApiUrl) {
			apiUrl = currentApiUrl;
		}
	});

	// Functions and helpers
	function handleRevert() {
		// Revert logic should ideally reset `currentCollectionValue` to a previous state.
		// For now, keep the console warning.
		console.warn('Revert function not implemented.');
	}

	// Determines if the tab header (Revision, Live Preview, API) should be visible.
	// Using `page.data.user` for user role.
	function getTabHeaderVisibility() {
		const userRole = page.data.user?.role;
		return userRole !== 'admin' && !collection.value?.revision;
	}

	// Filters fields based on user permissions.
	let filteredFields = $derived.by(() => {
		const userRole = page.data.user?.role || 'guest'; // Default to 'guest' if no role
		return derivedFields.filter((f) => {
			const permissions = f.permissions as RolePermissions | undefined;
			// If permissions are explicitly set and read is false for the user's role, filter it out.
			// Otherwise, it's readable.
			return !(permissions && permissions[userRole] && permissions[userRole].read === false);
		});
	});

	// Generates content for the Live Preview tab.
	function getLivePreviewContent() {
		const collectionName = collection.value?.name ? String(collection.value.name) : '';
		// In a real CMS, this would render a preview of the content using the actual field values.
		// For now, it's a placeholder.
		return `<div>Live Preview Content for Collection: <span class="font-bold text-tertiary-500 dark:text-primary-500">${collectionName}</span></div>`;
	}

	// Get the overall validation status of the form.
	let isFormInvalid = $derived.by(() => {
		// Get the current state of the validation store
		const currentValidationErrors = validationStore.get();
		// Check if any field in the filtered fields has an error
		return filteredFields.some((field) => {
			const fieldName = getFieldName(field, true);
			return currentValidationErrors[fieldName] !== undefined && currentValidationErrors[fieldName] !== null;
		});
	});
</script>

{#if isLoading}
	<div class="flex h-lvh items-center justify-between lg:justify-start">
		<Loading />
	</div>
{:else}
	<TabGroup
		justify="{collection.value?.revision === true ? 'justify-between md:justify-around' : 'justify-center '} items-center"
		rounded="rounded-tl-container-token rounded-tr-container-token"
		flex="flex-1 items-center"
		active="border-b border-tertiary-500 dark:border-primary-500 variant-soft-secondary"
		hover="hover:variant-soft-secondary"
		regionList={getTabHeaderVisibility() ? 'hidden' : ''}
		value={tabSet}
		on:change={(e) => (tabSet = e.detail)}
	>
		<Tab bind:group={tabSet} name="tab1" value={0}>
			<div class="flex items-center gap-1">
				<iconify-icon icon="mdi:pen" width="24" class="text-tertiary-500 dark:text-primary-500"> </iconify-icon>
				<p>{m.fields_edit()}</p>
				{#if isFormInvalid}
					<iconify-icon icon="mdi:alert-circle" width="18" class="text-error-500 ml-1"></iconify-icon>
				{/if}
			</div>
		</Tab>

		{#if collection.value?.revision === true}
			<Tab bind:group={tabSet} name="tab2" value={1}>
				<div class="flex items-center gap-1">
					<iconify-icon icon="pepicons-pop:countdown" width="24" class="text-tertiary-500 dark:text-primary-500"> </iconify-icon>
					<p>
						{m.applayout_version()}
						<span class="variant-outline-tertiary badge rounded-full dark:variant-outline-primary">1</span>
					</p>
				</div>
			</Tab>
		{/if}

		{#if collection.value?.livePreview === true}
			<Tab bind:group={tabSet} name="tab3" value={2}>
				<div class="flex items-center gap-1">
					<iconify-icon icon="mdi:eye-outline" width="24" class="text-tertiary-500 dark:text-primary-500"> </iconify-icon>
					<p>{m.Fields_preview()} Experimental</p>
				</div>
			</Tab>
		{/if}

		{#if page.data.user?.role === 'admin'}
			<Tab bind:group={tabSet} name="tab4" value={3}>
				<div class="flex items-center gap-1">
					<iconify-icon icon="ant-design:api-outlined" width="24" class="text-tertiary-500 dark:text-primary-500"> </iconify-icon>
					<p>API</p>
				</div>
			</Tab>
		{/if}

		<svelte:fragment slot="panel">
			{#if tabSet === 0}
				{#if filteredFields.some((f) => f.required)}
					<div class="mb-2 text-center text-xs text-error-500">{m.fields_required()}</div>
				{/if}
				<div class="rounded-md border bg-white px-4 py-6 drop-shadow-2xl dark:border-surface-500 dark:bg-surface-900">
					<div class="flex flex-wrap items-center justify-center gap-1 overflow-auto">
						{#each filteredFields as field (field.db_fieldName || field.id || field.label || field.name)}
							{#if field.widget}
								<div
									class="mx-auto text-center {!field?.width ? 'w-full ' : 'max-md:!w-full'}"
									style={'min-width:min(300px,100%);' + (field.width ? `width:calc(${Math.floor(100 / field?.width)}% - 0.5rem)` : '')}
								>
									<div class="flex justify-between px-[5px] text-start">
										<p class="inline-block font-semibold capitalize">
											{field.label || field.db_fieldName}
											{#if field.required}<span class="text-error-500">*</span>{/if}
										</p>

										<div class="flex gap-2">
											{#if field.translated}
												<div class="flex items-center gap-1 px-2">
													<iconify-icon icon="bi:translate" width="18" class="text-sm text-surface-500 dark:text-surface-400"> </iconify-icon>
													<div class="text-xs font-normal text-surface-500 dark:text-surface-400">
														{contentLanguage.value?.toUpperCase() ?? 'EN'}
													</div>
													{#if $translationProgress[contentLanguage.value]}
														<div class="text-xs font-normal text-surface-500 dark:text-surface-400">
															({Math.round(
																$translationProgress[contentLanguage.value]?.translated.has(
																	`${String(collection.value?.name)}.${getFieldName(field)}`
																)
																	? 100
																	: 0
															)}%)
														</div>
													{/if}
												</div>
											{/if}

											{#if field.icon}
												<iconify-icon icon={field.icon} width="22" class="text-surface-500 dark:text-surface-400"> </iconify-icon>
											{/if}
										</div>
									</div>

									{#if field.widget}
										{@const widgetDef = widgetFunctions.get().get(field.widget.Name as string)}
										{@const WidgetComponent = widgetDef && modules[widgetDef.componentPath] ? modules[widgetDef.componentPath]?.default : null}

										{#if WidgetComponent}
											<WidgetComponent
												{field}
												// Pass a writable store or bindable value
												bind:value={currentCollectionValue[getFieldName(field, true)]}
												on:input={() => {
													// Ensure `collectionValue` is updated reactively
													collectionValue.set({
														...collectionValue.value,
														...currentCollectionValue
													});
												}}
											/>
										{:else}
											<svelte:component
												this={modules['/src/widgets/MissingWidget.svelte']?.default}
												config={{ Name: field.widget.Name || 'Unknown Widget' }}
											/>
										{/if}
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			{:else if tabSet === 1}
				<div class="mb-2 flex items-center justify-between gap-2">
					<p class="text-center text-tertiary-500 dark:text-primary-500">
						{m.fields_revision_compare()}
					</p>
					<button class="variant-outline-tertiary btn dark:variant-ghost-primary" onclick={handleRevert}>{m.fields_revision_revert()}</button>
				</div>
				<select class="select mb-2">
					<option value="1">{m.fields_revision_most_recent()}</option>
					<option value="2">February 19th 2024, 4:00 PM</option>
				</select>

				<div class="flex justify-between dark:text-white">
					<div class="w-full text-center">
						<p class="mb-4 sm:mb-0">{m.fields_revision_current_version()}</p>
						<CodeBlock
							color="text-white dark:text-primary-500"
							language="JSON"
							rounded="rounded-container-token"
							lineNumbers={true}
							text="text-xs text-left w-full"
							buttonLabel=""
							code={JSON.stringify(collectionValue.value, null, 2)}
						/>
					</div>
					<div
						class="ml-1 min-h-[1em] w-px self-stretch bg-gradient-to-tr from-transparent via-neutral-500 to-transparent opacity-20 dark:opacity-100"
					></div>
					<div class="ml-1 w-full text-left">
						<p class="text-center text-tertiary-500">February 19th 2024, 4:00 PM</p>
						<CodeBlock
							color="text-white dark:text-primary-500"
							language="JSON"
							lineNumbers={true}
							text="text-xs text-left text-white dark:text-tertiary-500"
							buttonLabel=""
							code={JSON.stringify(collectionValue.value, null, 2)}
						/>
					</div>
				</div>
			{:else if tabSet === 2 && collection.value?.livePreview === true}
				<div class="wrapper">
					<h2 class="mb-4 text-center text-xl font-bold text-tertiary-500 dark:text-primary-500">Live Preview Experimental</h2>
					<div class="card variant-glass-secondary mb-4 p-1 sm:p-4">
						{@html getLivePreviewContent()}
					</div>
				</div>
			{:else if tabSet === 3}
				{#if collectionValue.value == null}
					<div class="variant-ghost-error mb-4 py-2 text-center font-bold">
						{m.fields_api_nodata()}
					</div>
				{:else}
					<div class="wrapper relative z-0 mb-4 flex w-full items-center justify-start gap-1">
						<p class="flex items-center">
							<span class="mr-1">API URL:</span>
							<iconify-icon icon="ph:copy" use:clipboard={apiUrl} class="pb-6 text-tertiary-500 dark:text-primary-500"> </iconify-icon>
						</p>
						<button class="btn text-wrap text-left" onclick={() => window.open(apiUrl, '_blank')} title={apiUrl}>
							<span class="text-wrap text-tertiary-500 dark:text-primary-500">{apiUrl}</span>
						</button>
					</div>

					<CodeBlock
						color="text-white dark:text-primary-500"
						language="JSON"
						lineNumbers={true}
						text="text-xs w-full"
						buttonLabel="Copy"
						code={JSON.stringify(collectionValue.value, null, 2)}
					/>
				{/if}
			{/if}
		</svelte:fragment>
	</TabGroup>
{/if}
