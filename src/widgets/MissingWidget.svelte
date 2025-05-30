<!--
@file src/widgets/MissingWidget.svelte 
@component
**Shows MissingWidget component to display missing widget**

@example
<MissingWidget />

### Props
- `config`: FieldType

### Features
- Translatable
-->

<script lang="ts">
	// Using $props() rune for props declaration
	let { config } = $props<{ config: { Name: string } }>(); // Add type definition for config
</script>

<div class="rounded-md border border-orange-200 bg-orange-50 p-4 text-orange-700">
	<p>
		⚠️ Widget "<span class="font-bold">{config.Name}</span>" is missing or disabled.
		<br />
		Please check the widget configuration or ensure it's active.
	</p>
</div>

<style>
	div {
		/* Example: A more noticeable border or shadow for attention */
		box-shadow: 0 2px 4px rgba(255, 165, 0, 0.2);
	}
</style>
