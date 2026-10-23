import closeFolderSvg from './assets/close-folder.svg';
import fileSvg from './assets/file.svg';
import folderSvg from './assets/folder.svg';
import mdCellSvg from './assets/md-cell.svg';
import openFolderSvg from './assets/open-folder.svg';
import type { PluginFeature } from './types';

const ICON_VARIABLES: Record<string, string> = {
	'--overlay-icon-folder': folderSvg,
	'--overlay-icon-file': fileSvg,
	'--overlay-icon-folder-open': openFolderSvg,
	'--overlay-icon-folder-closed': closeFolderSvg,
	'--overlay-icon-markdown-cell': mdCellSvg,
};

function toDataUri(svg: string): string {
	return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Exposes the bundled SVG assets as CSS variables so the theme can draw the
 * file explorer icons without referencing files at runtime.
 */
export class SidebarIcons implements PluginFeature {
	register(): void {
		for (const [property, svg] of Object.entries(ICON_VARIABLES)) {
			document.body.style.setProperty(property, toDataUri(svg));
		}
	}

	unregister(): void {
		for (const property of Object.keys(ICON_VARIABLES)) {
			document.body.style.removeProperty(property);
		}
	}
}
