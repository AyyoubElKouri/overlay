import { Plugin } from 'obsidian';
import type { PluginFeature } from './types';
import themeCss from '../minimal.css';

const THEME_FILE = 'minimal.css';
const WATCH_INTERVAL_MS = 1000;

/**
 * Loads the theme stylesheet.
 *
 * The stylesheet is bundled into `main.js` for production builds, because
 * Obsidian only installs `main.js`, `manifest.json`, and `styles.css` from a
 * release. Development builds read `minimal.css` from the plugin folder and
 * poll it so CSS edits apply without reloading the plugin.
 *
 * Obsidian injects `styles.css` as an inline style element. Adopting a
 * constructed stylesheet keeps the bundled theme separate without adding
 * another style element to the document.
 */
export class ThemeStyles implements PluginFeature {
	private readonly plugin: Plugin;
	private sheet: CSSStyleSheet | null = null;
	private active = false;
	private lastMtime = 0;
	private lastSize = -1;
	private reloading = false;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	register(): void {
		this.active = true;
		void this.load();

		this.plugin.addCommand({
			id: 'reload-theme-styles',
			name: 'Reload theme styles',
			callback: () => void this.load(true),
		});

		if (__DEV__) {
			this.plugin.registerInterval(
				window.setInterval(
					() => void this.checkForChanges(),
					WATCH_INTERVAL_MS,
				),
			);
		}
	}

	unregister(): void {
		this.active = false;

		if (this.sheet) {
			document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
				(sheet) => sheet !== this.sheet,
			);
			this.sheet = null;
		}

		this.lastMtime = 0;
		this.lastSize = -1;
	}

	private getStylePath(): string {
		const dir =
			this.plugin.manifest.dir ?? `.obsidian/plugins/${this.plugin.manifest.id}`;

		return `${dir}/${THEME_FILE}`;
	}

	private async checkForChanges(): Promise<void> {
		if (!this.active || this.reloading) return;

		this.reloading = true;
		try {
			await this.load();
		} finally {
			this.reloading = false;
		}
	}

	private async load(force = false): Promise<void> {
		if (!__DEV__) {
			this.apply(themeCss);
			return;
		}

		const path = this.getStylePath();

		try {
			const stat = await this.plugin.app.vault.adapter.stat(path);
			if (!stat) {
				this.apply(themeCss);
				return;
			}

			if (
				!force &&
				this.sheet &&
				stat.mtime === this.lastMtime &&
				stat.size === this.lastSize
			) {
				return;
			}

			const css = await this.plugin.app.vault.adapter.read(path);
			this.apply(css);

			this.lastMtime = stat.mtime;
			this.lastSize = stat.size;
		} catch (error) {
			console.error(`Overlay: unable to load ${THEME_FILE}`, error);
			this.apply(themeCss);
		}
	}

	private apply(css: string): void {
		if (!this.active) return;

		if (this.sheet) {
			this.sheet.replaceSync(css);
		} else {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(css);
			document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
			this.sheet = sheet;
		}
	}
}
