/**
@file src/widgets/core/input/types.ts
@description - Input widget types and schemas.
*/

import { publicEnv } from '@root/config/public';
import { toStringHelper } from '@utils/utils';

// Components (Ensure these paths are correct and components are Svelte components)
import IconifyPicker from '@components/IconifyPicker.svelte';
import InputComponent from '@components/system/inputs/Input.svelte'; // Renamed to avoid conflict with widget name
import Toggles from '@components/system/inputs/Toggles.svelte';
import PermissionsSetting from '@components/PermissionsSetting.svelte';

// Auth
import type { Permission } from '@src/auth/auth';
import type { SvelteComponent } from 'svelte'; // Import SvelteComponent type

// Defines the parameters that can be passed when configuring an Input widget instance
export type Params = {
	// Common field parameters
	label: string;
	display?: ((args: { data: unknown; contentLanguage: string }) => string | Promise<string>); // More explicit display function type
	db_fieldName?: string;
	widget?: unknown; // This property seems redundant if `widget` is returned as a whole object. Consider removing.
	required?: boolean;
	translated?: boolean;
	icon?: string;
	helper?: string;
	width?: number;

	// Permissions (consider defining a more specific type if `Permission[]` is too generic)
	permissions?: Permission[];

	// Widget Specific parameters for the Input field
	placeholder?: string;
	count?: number; // Target exact character count
	minlength?: number;
	maxlength?: number;
	prefix?: string;
	suffix?: string;
	readonly?: boolean;
	disabled?: boolean;
	widgetId?: string; // Add widgetId to params for internal use
};

// Defines the structure for generating the GUI fields for the Input widget
export const GuiSchema = {
	properties: {
		label: { widget: InputComponent as typeof SvelteComponent, required: true },
		display: { widget: InputComponent as typeof SvelteComponent, required: false }, // display is optional
		db_fieldName: { widget: InputComponent as typeof SvelteComponent, required: true },
		required: { widget: Toggles as typeof SvelteComponent, required: false },
		translated: { widget: Toggles as typeof SvelteComponent, required: false },
		icon: { widget: IconifyPicker as typeof SvelteComponent, required: false },
		helper: { widget: InputComponent as typeof SvelteComponent, required: false },
		width: { widget: InputComponent as typeof SvelteComponent, required: false },

		// Permissions
		permissions: { widget: PermissionsSetting as typeof SvelteComponent, required: false },

		// Widget Specific parameters
		placeholder: { widget: InputComponent as typeof SvelteComponent, required: false },
		count: { widget: InputComponent as typeof SvelteComponent, required: false },
		minlength: { widget: InputComponent as typeof SvelteComponent, required: false },
		maxlength: { widget: InputComponent as typeof SvelteComponent, required: false },
		prefix: { widget: InputComponent as typeof SvelteComponent, required: false },
		suffix: { widget: InputComponent as typeof SvelteComponent, required: false },
		readonly: { widget: Toggles as typeof SvelteComponent, required: false },
		disabled: { widget: Toggles as typeof SvelteComponent, required: false }
	}
};

// Defines the type for a GraphQL schema generation function
export type GraphqlSchemaFn = ({ label, collection }: { label: string; collection: { _id: string } }) => { typeID: string; graphql: string };

// Function to generate the GraphQL schema for the Input widget
export const GraphqlSchema: GraphqlSchemaFn = ({ label, collection }) => {
	// Create a unique type name by combining the collection ID and label
	const typeID = `${collection._id}_${label}`;

	// Generate GraphQL fields for each available content language
	const graphqlFields = publicEnv.AVAILABLE_CONTENT_LANGUAGES.map((contentLanguage) => `${contentLanguage.toLowerCase()}: String`).join('\n');

	return {
		typeID,
		graphql: /* GraphQL */ `
			type ${typeID} {
				${graphqlFields}
			}
		`
	};
};

// Helper function to convert the Input widget's data to a string representation
export function toString({ field, data }: { field: unknown; data: Record<string, unknown> }): string {
	return toStringHelper({
		field,
		data,
		path: (lang) => {
			return data[lang]; // Access the data for the given language
		}
	});
}

// Define `GuiSchema` more formally for better type safety
export interface GuiSchemaProperties {
	[key: string]: {
		widget: typeof SvelteComponent; // Svelte component constructor
		required: boolean;
	};
}

export interface GuiSchema {
	properties: GuiSchemaProperties;
}
