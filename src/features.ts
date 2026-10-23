import { Plugin } from 'obsidian';
import { AutoHideTabs } from './auto-hide-tabs';
import { MinimalUi } from './minimal-ui';
import { SidebarIcons } from './sidebar-icons';
import { SidebarNesting } from './sidebar-nesting';
import { SidebarToggle } from './sidebar-toggle';
import { ThemeStyles } from './theme-styles';
import type { PluginFeature } from './types';

/**
 * Central registry for plugin features. Add new features here so `main.ts`
 * stays focused on the plugin lifecycle.
 */
export class PluginFeatures {
	private readonly features: PluginFeature[];

	constructor(plugin: Plugin) {
		this.features = [
			new ThemeStyles(plugin),
			new SidebarIcons(),
			new SidebarNesting(plugin),
			new SidebarToggle(plugin),
			new AutoHideTabs(plugin),
			new MinimalUi(),
		];
	}

	register(): void {
		for (const feature of this.features) {
			feature.register();
		}
	}

	unregister(): void {
		for (const feature of this.features) {
			feature.unregister();
		}
	}
}
