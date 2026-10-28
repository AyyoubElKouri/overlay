import type { Plugin } from "obsidian";
import { createIconSyntaxExtension } from "./live-preview";
import { closeActiveIconPicker } from "./picker-modal";
import { registerReadingView } from "./reading-view";

/** Registers every icon-syntax surface. */
export function registerIconSyntaxFeature(plugin: Plugin): void {
	registerReadingView(plugin);
	plugin.registerEditorExtension(createIconSyntaxExtension(plugin.app));
	plugin.register(closeActiveIconPicker);
}
