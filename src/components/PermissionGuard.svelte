<!--
@file src/components/PermissionGuard.svelte
@component
**PermissionGuard component for permission-based access control that wraps content with conditional rendering and error handling**

@example
<PermissionGuard {config}>
	<ContentToProtect />
</PermissionGuard>

#### Props:
- `config`: Permission configuration object
- `messages`: Custom messages for different scenarios

Features:
- Checks user permissions based on provided configuration
- Handles admin roles, regular permissions, and rate limiting
- Provides fallback content for missing configurations or insufficient permissions
- Improved type safety and error handling
-->

<script lang="ts">
	import { page } from '$app/state'; // Use $app/state for consistent access to page data

	// Auth types
	import type { PermissionConfig } from '@src/auth/permissions';
	import type { User } from '@src/auth/types';

	interface Props {
		// Prop to receive permission configuration
		config: PermissionConfig | undefined;
		messages?: {
			rateLimited?: string;
			missingConfig?: string;
			insufficientPermissions?: string;
		};
		children?: import('svelte').Snippet;
	}

	// Destructure props using $props()
	let {
		config,
		messages = {
			rateLimited: 'Rate limit reached. Please try again later.',
			missingConfig: 'Permission configuration is missing.',
			insufficientPermissions: 'You do not have permission to access this content.'
		},
		children
	}: Props = $props();

	// Reactive state: Direct use of $state for local component state
	// Removed the custom 'store' utility. If 'loading' is truly global state,
	// it should come from 'appStore'. For component-local loading, $state is ideal.
	let loading = $state(false); // Example: if PermissionGuard itself initiated a loading state

	// Reactive variables from SvelteKit's $page store using $derived
	// Access page.data directly; Svelte 5 $derived handles reactivity automatically.
	let user = $derived(page.data.user as User | undefined);
	let permissions = $derived((page.data.permissions || {}) as Record<string, { hasPermission: boolean; isRateLimited: boolean }>);

	// Derived state: Cleanly calculate permissions and flags
	// These values automatically recompute whenever their dependencies (user, permissions, config) change.
	let permissionData = $derived(
		config?.contextId
			? permissions[config.contextId] || { hasPermission: false, isRateLimited: false }
			: { hasPermission: false, isRateLimited: false }
	);

	let isAdmin = $derived(user?.role?.toLowerCase() === 'admin');
	let hasPermission = $derived(isAdmin || permissionData.hasPermission); // Simplified, `|| false` is redundant as boolean property ensures this
	let isRateLimited = $derived(permissionData.isRateLimited); // Simplified, `|| false` is redundant

	// Final determination if content should be shown
	let shouldShowContent = $derived(!!config && hasPermission && !isRateLimited && !loading);

	// Optional: Debugging effect (only runs in development)
	// Using $effect ensures this runs reactively when its dependencies change.
	$effect(() => {
		if (import.meta.env.DEV) {
			console.debug('PermissionGuard Debug Info:', {
				user,
				config,
				permissions,
				permissionData,
				isAdmin,
				hasPermission,
				isRateLimited,
				shouldShowContent,
				loading
			});
		}
	});
</script>

{#if shouldShowContent}
	{@render children?.()}
{:else if config}
	{#if isRateLimited}
		<p class="text-warning-500" role="alert">{messages.rateLimited}</p>
	{:else}
		<p class="text-error-500" role="alert">{messages.insufficientPermissions}</p>
	{/if}
{:else}
	<p class="text-error-500" role="alert">{messages.missingConfig}</p>
{/if>
