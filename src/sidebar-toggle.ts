import { Plugin, setIcon, setTooltip } from 'obsidian';
import type { PluginFeature } from './types';

const SIDEBAR_CHROME_HIDDEN_CLASS = 'overlay-clean-sidebar';
const TOGGLE_BUTTON_CLASS = 'overlay-sidebar-toggle';

/**
 * Removes the left ribbon and the sidebar tab bar, then puts the sidebar
 * toggle next to the file explorer actions (new note, new folder, ...).
 */
export class SidebarToggle implements PluginFeature {
	private readonly plugin: Plugin;
	private readonly toggleButtons = new Set<HTMLElement>();
	private active = false;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	register(): void {
		this.active = true;
		document.body.addClass(SIDEBAR_CHROME_HIDDEN_CLASS);
		this.registerCommand();
		this.registerLayoutListeners();
	}

	unregister(): void {
		this.active = false;
		document.body.removeClass(SIDEBAR_CHROME_HIDDEN_CLASS);

		for (const button of this.toggleButtons) {
			button.remove();
		}
		this.toggleButtons.clear();
	}

	private registerCommand(): void {
		this.plugin.addCommand({
			id: 'toggle-left-sidebar',
			name: 'Toggle left sidebar',
			callback: () => this.toggleLeftSidebar(),
		});
	}

	private registerLayoutListeners(): void {
		this.plugin.app.workspace.onLayoutReady(() => this.addFileExplorerToggles());
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('layout-change', () => this.addFileExplorerToggles()),
		);
	}

	private addFileExplorerToggles(): void {
		if (!this.active) return;

		for (const leaf of this.plugin.app.workspace.getLeavesOfType('file-explorer')) {
			const navButtons = leaf.view.containerEl.querySelector<HTMLElement>(
				'.nav-buttons-container',
			);
			if (!navButtons || navButtons.querySelector(`.${TOGGLE_BUTTON_CLASS}`)) {
				continue;
			}

			const button = this.createToggleButton();
			navButtons.prepend(button);
			this.toggleButtons.add(button);
		}
	}

	private createToggleButton(): HTMLElement {
		const button = createDiv({
			cls: `clickable-icon nav-action-button ${TOGGLE_BUTTON_CLASS}`,
		});
		setIcon(button, 'panel-left-close');
		setTooltip(button, 'Collapse left sidebar');
		button.addEventListener('click', (event) => {
			event.preventDefault();
			this.toggleLeftSidebar();
		});
		return button;
	}

	private toggleLeftSidebar(): void {
		this.plugin.app.workspace.leftSplit.toggle();
	}
}
