import { type Plugin } from "obsidian";
import fileIcon from "../../assets/file.svg";
import folderOpenIcon from "../../assets/folder-open.svg";
import folderIcon from "../../assets/folder.svg";

const STYLE_ID = "overlay-file-icons";
const SVG_PREFIX = "data:image/svg+xml,";

// Wrap an SVG's markup in a mask URL; the mask keeps the alpha shape so
// `background-color: currentColor` lets the icon follow the theme.
function toMaskUrl(svg: string): string {
	return `url("${SVG_PREFIX}${encodeURIComponent(svg)}")`;
}

function maskRule(mask: string): string {
	return `-webkit-mask: ${mask} center / contain no-repeat;
	mask: ${mask} center / contain no-repeat;`;
}

// Replace the file explorer's collapse chevron with folder glyphs, and add a
// file glyph to every file row. Scoped to `.nav-files-container` so other
// trees (outline, tags, search) keep Obsidian's default indicators.
const fileIconsCss = `
/* Obsidian defines its size tokens on \`body\`, so read them from there too. */
body {
	--overlay-nav-icon-size: var(--size-4-4);
}

/*
 * Folder and file rows share one absolute icon slot. Painting on the row
 * itself (not on the collapse indicator) covers folders without children,
 * where Obsidian never renders an indicator. Stretching the slot vertically
 * with margin-block: auto centers each glyph with its row.
 */
.nav-files-container .nav-folder:not(.mod-root) .nav-folder-title::before,
.nav-files-container .nav-file-title::before {
	content: "";
	position: absolute;
	top: 0;
	bottom: 0;
	width: var(--overlay-nav-icon-size);
	height: var(--overlay-nav-icon-size);
	margin-block: auto;
	margin-inline-start: calc(-1 * var(--size-4-5));
	/* Use the brighter body-text color; the muted row color made the strokes faint. */
	background-color: var(--text-normal);
}

/* Hide the default chevron; the folder glyph below replaces it. */
.nav-files-container .nav-folder:not(.mod-root) .nav-folder-title .collapse-icon > svg {
	display: none;
}

.nav-files-container .nav-folder:not(.mod-root) .nav-folder-title::before {
	${maskRule(toMaskUrl(folderOpenIcon))}
}

/* Collapsed folders swap to the closed glyph. */
.nav-files-container .nav-folder.is-collapsed:not(.mod-root) > .nav-folder-title::before {
	${maskRule(toMaskUrl(folderIcon))}
}

.nav-files-container .nav-file-title::before {
	${maskRule(toMaskUrl(fileIcon))}
}
`;

// Mount the stylesheet once per window and drop it when the window closes.
function applyFileIcons(doc: Document): void {
	if (doc.getElementById(STYLE_ID)) return;
	const style = doc.createElement("style");
	style.id = STYLE_ID;
	style.textContent = fileIconsCss;
	doc.head.appendChild(style);
}

export function registerFileIconsFeature(plugin: Plugin): void {
	applyFileIcons(document);
	plugin.registerEvent(plugin.app.workspace.on("window-open", (_workspaceWindow, window) => {
		applyFileIcons(window.document);
	}));
	plugin.registerEvent(plugin.app.workspace.on("window-close", (_workspaceWindow, window) => {
		window.document.getElementById(STYLE_ID)?.remove();
	}));
	plugin.register(() => document.getElementById(STYLE_ID)?.remove());
}
