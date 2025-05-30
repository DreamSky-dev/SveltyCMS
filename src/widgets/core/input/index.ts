/**
 * @file src/widgets/core/input/index.ts
 * @description - Input index file.
 */

import { publicEnv } from '@root/config/public';
import { getFieldName, getGuiFields } from '@utils/utils';
import { GuiSchema, GraphqlSchema, type Params } from './types';
// ParaglideJS messages
import * as m from '@src/paraglide/messages';
import type { WidgetPlaceholder, WidgetFunction } from '../../types'; // Import necessary types
import type { Aggregations } from '@src/content/types'; // Assuming Aggregations type exists

const WIDGET_NAME = 'Input' as const;

// Defines the Input widget's behavior and structure
const widget = (params: Params): WidgetPlaceholder & Omit<Params, 'widget'> => {
	let display: ((args: { data: Record<string, string>; contentLanguage: string }) => string) | ((args: { data: unknown; contentLanguage: string }) => Promise<string>);

	if (!params.display) {
		// Default display function if not provided in params.
		display = ({ data, contentLanguage }) => {
			const value = data ? (data as Record<string, string>)[contentLanguage] : '';
			return params.translated ? value || m.widgets_nodata() : (data as Record<string, string>)?.[publicEnv.DEFAULT_CONTENT_LANGUAGE] || m.widgets_nodata();
		};
		// Mark it as default for potential later checks.
		(display as any).default = true;
	} else {
		display = params.display as any; // Cast to any because `Params` display type is too broad
	}

	// Define the field object which combines widget-specific properties with common field properties
	const field = {
		display,
		label: params.label,
		db_fieldName: params.db_fieldName,
		translated: params.translated,
		required: params.required,
		icon: params.icon,
		width: params.width,
		helper: params.helper,
		permissions: params.permissions,
		placeholder: params.placeholder,
		count: params.count,
		minlength: params.minlength,
		maxlength: params.maxlength,
		prefix: params.prefix,
		suffix: params.suffix,
		readonly: params.readonly,
		disabled: params.disabled
	};

	// Return a `WidgetPlaceholder` combined with the field properties.
	// The `__widgetId` and `__widgetName` will be set by the `createWidgetFunction` in `index.ts`.
	return {
		__widgetId: params.widgetId || '', // This will be overwritten by `uuidv4` in `initializeWidgets`
		__widgetName: WIDGET_NAME,
		__widgetConfig: field, // The configuration for the widget instance
		...field // Spread field properties directly for easy access
	};
};

// Assign static properties to the widget function for global access and metadata
(widget as WidgetFunction).Name = WIDGET_NAME;
(widget as WidgetFunction).GuiSchema = GuiSchema;
(widget as WidgetFunction).GraphqlSchema = GraphqlSchema;
(widget as WidgetFunction).Icon = 'icon-park-outline:text';
(widget as WidgetFunction).Description = m.widget_text_description();

// Widget Aggregations for filtering and sorting data
(widget as WidgetFunction).aggregations = {
	filters: async (info) => {
		const field = info.field as FieldType; // Cast to FieldType for correct property access
		return [
			{
				$match: {
					[`${getFieldName(field)}.${info.contentLanguage}`]: { $regex: info.filter, $options: 'i' }
				}
			}
		];
	},
	sorts: async (info) => {
		const field = info.field as FieldType; // Cast to FieldType
		const fieldName = getFieldName(field);
		return [{ $sort: { [`${fieldName}.${info.contentLanguage}`]: info.sort } }];
	}
} as Aggregations; // Explicitly type as Aggregations

// Export FieldType for consistent typing across the application.
export type FieldType = ReturnType<typeof widget>;
export default widget;
