import { getIcon, setIcon, setTooltip } from "obsidian";
import { resolveIcon } from "./icon-resolution";

export interface IconBoxOptions {
	/** Icon ID to render. */
	name: string;
	/** Untrimmed token text, kept on the box so edits can target it. */
	raw?: string;
	onActivate: () => void;
}

/** Applies the icon and its labels to an existing box. */
function paint(box: HTMLElement, name: string, raw?: string): void {
	const icon = resolveIcon(name, (id) => Boolean(getIcon(id)));
	box.empty();
	setIcon(box, icon.id);
	box.dataset.iconName = name;
	if (raw !== undefined) box.dataset.iconRaw = raw;
	box.toggleClass("is-missing", icon.missing);
	box.removeAttribute("data-tooltip");
	box.removeAttribute("data-tooltip-position");
	// One label for both the accessible name and the visible tooltip: setTooltip
	// derives the tooltip from aria-label, so the two must be the same string.
	const label = icon.missing
		? `Unknown icon: ${name}. Click to choose a replacement.`
		: `Replace icon ${name}.`;
	box.setAttribute("aria-label", label);
	setTooltip(box, label);
}

/** Builds one clickable icon box. */
export function createIconBox(options: IconBoxOptions): HTMLSpanElement {
	const box = createSpan({ cls: "overlay-icon-box" });
	box.tabIndex = 0;
	box.setAttribute("role", "button");
	paint(box, options.name, options.raw);

	box.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		options.onActivate();
	});
	box.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		options.onActivate();
	});
	return box;
}

/** Repaints a box after a new icon was chosen. */
export function updateIconBox(box: HTMLElement, name: string, raw?: string): void {
	paint(box, name, raw);
}
