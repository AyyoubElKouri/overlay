import { type Plugin, type Workspace, type WorkspaceLeaf } from "obsidian";
import { THEME_DESIGNS, THEME_MODES, type ThemeMode } from "./themes";
import { ThemePickerView } from "./view";

const VIEW_TYPE = "overlay-theme-picker";
const STYLE_ID = "overlay-theme-styles";
// Share an in-progress open so rapid command and lifecycle calls cannot create duplicate leaves.
const pendingOpens = new WeakMap<Workspace, Promise<void>>();

// Keep every window's palette rules in sync with the single theme registry.
const themeCss = [
	...THEME_DESIGNS.flatMap((design) => THEME_MODES.map((mode) => {
		const { background, zone, border } = design[mode];
		return `body[data-overlay-theme="${design.id}"].theme-${mode} {
	--overlay-canvas: ${background};
	--overlay-zone: ${zone};
	--overlay-zone-border: ${border};
}`;
	})),
	`body[data-overlay-theme] {
	--background-primary: var(--overlay-zone);
	--background-secondary: var(--overlay-canvas);
	--background-secondary-alt: var(--overlay-canvas);
	--background-modifier-border: var(--overlay-zone-border);
	--background-modifier-border-hover: var(--overlay-zone-border);
	--background-modifier-border-focus: var(--overlay-zone-border);
	--divider-color: var(--overlay-zone-border);
}`,
].join("\n\n");

// Use Parchment for missing or unrecognized saved design IDs.
function getThemeDesign(themeId: string) {
	return THEME_DESIGNS.find((design) => design.id === themeId) ?? THEME_DESIGNS[0]!;
}

// Apply the generated palette CSS to one Obsidian window.
function applyTheme(doc: Document, themeId: string): void {
	// Reuse the stable style element so applying a theme never adds another copy.
	const style = doc.getElementById(STYLE_ID) ?? doc.createElement("style");
	style.id = STYLE_ID;
	style.textContent = themeCss;
	if (!style.isConnected) doc.head.appendChild(style);
	if (doc.body) doc.body.dataset.overlayTheme = getThemeDesign(themeId).id;
}

// Remove Overlay's injected theme from one window.
function clearTheme(doc: Document): void {
	doc.getElementById(STYLE_ID)?.remove();
	doc.body?.removeAttribute("data-overlay-theme");
}

// Find saved picker leaves, including Obsidian's deferred views.
function getPickerLeaves(workspace: Workspace): WorkspaceLeaf[] {
	const leaves: WorkspaceLeaf[] = [];
	// View state also finds leaves whose ItemView has not been constructed yet.
	workspace.iterateAllLeaves((leaf) => {
		if (leaf.getViewState().type === VIEW_TYPE) leaves.push(leaf);
	});
	return leaves;
}

// Reuse one picker leaf, remove stale duplicates, and open it.
export function openThemePicker(workspace: Workspace): Promise<void> {
	const pending = pendingOpens.get(workspace);
	if (pending) return pending;

	const opening = (async () => {
		const [existing, ...duplicates] = getPickerLeaves(workspace);
		// Keep one saved picker leaf when restoring layouts that contain duplicates.
		duplicates.forEach((leaf) => leaf.detach());
		const leaf = existing ?? workspace.getLeftLeaf(false);
		if (!leaf) return;
		if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
		await workspace.revealLeaf(leaf);
	})();

	pendingOpens.set(workspace, opening);
	// Clear the lock on either outcome so a failed open can be retried.
	const clearPending = () => pendingOpens.delete(workspace);
	void opening.then(clearPending, clearPending);
	return opening;
}

// Register picker UI, persistence, events, and per-window theme cleanup.
export async function registerThemePickerFeature(plugin: Plugin): Promise<void> {
	const saved = await plugin.loadData() as { themeId?: string } | null;
	let themeId = getThemeDesign(saved?.themeId ?? "parchment").id;
	// Track pop-out documents so their injected CSS is removed on close or unload.
	const documents = new Set<Document>();

	// Remember each styled document so its theme can be cleaned up later.
	function applyToWindow(doc: Document): void {
		applyTheme(doc, themeId);
		documents.add(doc);
	}

	async function selectTheme(id: string, mode: ThemeMode): Promise<void> {
		// Apply the design and requested Obsidian mode before saving and refreshing the picker.
		themeId = getThemeDesign(id).id;
		documents.forEach(applyToWindow);
		// Obsidian updates its mode classes and settings through this internal, untyped API.
		const vault = plugin.app.vault as unknown as {
			setConfig: (key: "theme", value: "obsidian" | "moonstone") => void;
		};
		vault.setConfig("theme", mode === "dark" ? "obsidian" : "moonstone");
		await plugin.saveData({ themeId });
		refreshPicker();
	}

	function refreshPicker(): void {
		// Deferred leaves have no view instance yet, so refresh only constructed views.
		for (const leaf of getPickerLeaves(plugin.app.workspace)) {
			if (leaf.view instanceof ThemePickerView) leaf.view.refresh();
		}
	}

	plugin.registerView(VIEW_TYPE, (leaf) => new ThemePickerView(leaf, selectTheme));
	// Apply the current palette to new pop-outs and release their documents when they close.
	plugin.registerEvent(plugin.app.workspace.on("window-open", (_workspaceWindow, window) => applyToWindow(window.document)));
	plugin.registerEvent(plugin.app.workspace.on("window-close", (_workspaceWindow, window) => {
		clearTheme(window.document);
		documents.delete(window.document);
	}));
	plugin.registerEvent(plugin.app.workspace.on("css-change", refreshPicker));
	plugin.addCommand({
		id: "overlay:open-theme-picker",
		name: "Open theme picker",
		callback: () => { void openThemePicker(plugin.app.workspace); },
	});
	applyToWindow(document);
	// Open once after Obsidian restores its layout so the picker tab is available on enable.
	plugin.app.workspace.onLayoutReady(() => {
		if (getPickerLeaves(plugin.app.workspace).length !== 1) void openThemePicker(plugin.app.workspace);
	});
	// Obsidian does not own these injected styles, so remove them when the plugin unloads.
	plugin.register(() => {
		documents.forEach(clearTheme);
		documents.clear();
	});
}
