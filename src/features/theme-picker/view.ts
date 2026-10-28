import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { THEME_DESIGNS, THEME_MODES, type ThemeMode } from "./themes";

const VIEW_TYPE = "overlay-theme-picker";

export class ThemePickerView extends ItemView {
	constructor(leaf: WorkspaceLeaf, private readonly applySelection: (id: string, mode: ThemeMode) => Promise<void>) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE; }
	getDisplayText(): string { return "Themes"; }
	getIcon(): string { return "swatch-book"; }

	// Render the initial selection when Obsidian opens the view.
	async onOpen(): Promise<void> {
		this.refresh();
	}

	// Rebuild the controls from the current mode and active design.
	refresh(): void {
		const container = this.contentEl;
		const doc = container.ownerDocument;
		// Read Obsidian's current mode so previews stay accurate when users switch modes elsewhere.
		const activeMode: ThemeMode = doc.body.classList.contains("theme-dark") ? "dark" : "light";
		const activeId = doc.body.dataset.overlayTheme;
		container.empty();
		container.addClass("overlay-theme-picker");

		for (const design of THEME_DESIGNS) {
			// Keep each design's light and dark choices together for easy comparison.
			const card = container.createDiv({ cls: "overlay-theme-picker__card" });
			card.createEl("h3", { text: design.name, cls: "overlay-theme-picker__title" });
			const options = card.createDiv({ cls: "overlay-theme-picker__options" });

			for (const mode of THEME_MODES) {
				const palette = design[mode];
				const active = activeId === design.id && activeMode === mode;
				// Real buttons provide keyboard activation and expose the selected option to assistive tech.
				const button = options.createEl("button", {
					cls: `overlay-theme-picker__option${active ? " is-active" : ""}`,
					attr: {
						type: "button",
						"aria-pressed": String(active),
						"aria-label": `Apply ${design.name} ${mode} theme`,
					},
				});
				button.addEventListener("click", () => { void this.applySelection(design.id, mode); });

				// Mirror the app canvas, centered note zone, and its side borders in miniature.
				const preview = button.createSpan({ cls: "overlay-theme-picker__miniature" });
				preview.style.backgroundColor = palette.background;
				const zone = preview.createSpan({ cls: "overlay-theme-picker__zone" });
				zone.style.backgroundColor = palette.zone;
				zone.style.borderLeftColor = palette.border;
				zone.style.borderRightColor = palette.border;

				const caption = button.createSpan({ cls: "overlay-theme-picker__caption" });
				caption.createSpan({ text: mode === "light" ? "Light" : "Dark" });
				const check = caption.createSpan({ cls: "overlay-theme-picker__check" });
				// Keep a visible check in addition to the active outline.
				if (active) setIcon(check, "check");
			}
		}
	}
}
