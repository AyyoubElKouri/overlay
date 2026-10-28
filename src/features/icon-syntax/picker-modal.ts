import { Modal, getIconIds, setIcon, type App } from "obsidian";
import { filterIconIds } from "./catalog";
import { paginate } from "./pagination";

let activePicker: IconPickerModal | null = null;

/** Opens one picker at a time. */
export function openIconPicker(app: App, current: string, onChoose: (name: string) => void): void {
	activePicker?.close();
	activePicker = new IconPickerModal(app, current, (name) => {
		activePicker = null;
		onChoose(name);
	});
	activePicker.open();
}

/** Closes the picker that is currently open, if any. */
export function closeActiveIconPicker(): void {
	activePicker?.close();
	activePicker = null;
}

class IconPickerModal extends Modal {
	private query = "";
	private page = 1;
	private resultsEl!: HTMLElement;
	private footerEl!: HTMLElement;
	private readonly iconIds = getIconIds().slice().sort((a, b) => a.localeCompare(b));

	constructor(
		app: App,
		private readonly current: string,
		private readonly onChoose: (name: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Choose an icon");
		this.contentEl.addClass("overlay-icon-picker");

		const search = this.contentEl.createEl("input", {
			type: "search",
			cls: "overlay-icon-picker__search",
			attr: { placeholder: "Search icons…", "aria-label": "Search icons" },
		});
		search.addEventListener("input", () => {
			this.query = search.value;
			this.page = 1;
			this.renderResults();
		});

		this.resultsEl = this.contentEl.createDiv({ cls: "overlay-icon-picker__results" });
		this.footerEl = this.contentEl.createDiv({ cls: "overlay-icon-picker__footer" });
		this.renderResults();
		search.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		if (activePicker === this) activePicker = null;
	}

	private renderResults(): void {
		this.resultsEl.empty();
		this.footerEl.empty();
		const matches = filterIconIds(this.iconIds, this.query);
		const { items, page, pageCount } = paginate(matches, this.page);
		this.page = page;

		if (items.length === 0) {
			this.resultsEl.createDiv({
				cls: "overlay-icon-picker__empty",
				text:
					this.iconIds.length === 0
						? "No icons are available."
						: "No icons match your search.",
			});
		} else {
			const grid = this.resultsEl.createDiv({ cls: "overlay-icon-picker__grid" });
			for (const id of items) {
				const tile = grid.createEl("button", {
					cls: `overlay-icon-picker__tile${id === this.current ? " is-active" : ""}`,
					attr: {
						type: "button",
						"aria-label": id,
						"aria-pressed": String(id === this.current),
					},
				});
				const glyph = tile.createSpan({ cls: "overlay-icon-picker__glyph" });
				setIcon(glyph, id);
				tile.addEventListener("click", () => this.choose(id));
			}
		}

		const previous = this.footerEl.createEl("button", { text: "Previous", attr: { type: "button" } });
		this.footerEl.createSpan({
			cls: "overlay-icon-picker__page",
			text: `Page ${page} of ${pageCount}`,
		});
		const next = this.footerEl.createEl("button", { text: "Next", attr: { type: "button" } });
		previous.disabled = page <= 1;
		next.disabled = page >= pageCount;
		previous.addEventListener("click", () => {
			this.page = page - 1;
			this.renderResults();
		});
		next.addEventListener("click", () => {
			this.page = page + 1;
			this.renderResults();
		});
	}

	private choose(name: string): void {
		this.close();
		this.onChoose(name);
	}
}
