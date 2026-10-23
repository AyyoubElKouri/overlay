import { Plugin } from 'obsidian';
import type { PluginFeature } from './types';

const ROW_SELECTOR = '.nav-files-container .tree-item-self';
const CHILDREN_SELECTOR = '.nav-files-container .tree-item-children';
const INDENT_PX = 30;

/**
 * Applies the explorer indentation to the actual rendered rows. Obsidian's
 * tree wrappers are layoutless in recent versions, so changing their margin
 * only moves text in some layouts. Rows receive a depth-derived CSS variable
 * instead, which moves every cell in the row as one unit.
 */
export class SidebarNesting implements PluginFeature {
	private readonly plugin: Plugin;
	private readonly observers = new Set<MutationObserver>();
	private readonly observedContainers = new Set<HTMLElement>();
	private active = false;
	private syncQueued = false;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	register(): void {
		this.active = true;
		this.plugin.app.workspace.onLayoutReady(() => this.watchAndSync());
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('layout-change', () => this.watchAndSync()),
		);
	}

	unregister(): void {
		this.active = false;
		this.syncQueued = false;

		for (const observer of this.observers) {
			observer.disconnect();
		}
		this.observers.clear();
		this.observedContainers.clear();

		for (const row of this.findElements(document, ROW_SELECTOR)) {
			row.style.removeProperty('--overlay-tree-offset');
		}
		for (const children of this.findElements(document, CHILDREN_SELECTOR)) {
			children.style.removeProperty('--overlay-guide-offset');
		}
	}

	private watchAndSync(): void {
		if (!this.active) return;

		for (const leaf of this.plugin.app.workspace.getLeavesOfType('file-explorer')) {
			const container = leaf.view.containerEl;
			if (this.observedContainers.has(container)) continue;

			const observer = new MutationObserver(() => this.queueSync());
			observer.observe(container, { childList: true, subtree: true });
			this.observers.add(observer);
			this.observedContainers.add(container);
		}

		this.sync();
	}

	private queueSync(): void {
		if (!this.active || this.syncQueued) return;

		this.syncQueued = true;
		queueMicrotask(() => {
			this.syncQueued = false;
			this.sync();
		});
	}

	private sync(): void {
		if (!this.active) return;

		for (const container of this.findElements(document, '.nav-files-container')) {
			for (const children of this.findElements(container, '.tree-item-children')) {
				const depth = this.countChildAncestors(children, container);
				children.style.setProperty(
					'--overlay-guide-offset',
					`${Math.max(0, depth - 1) * INDENT_PX}px`,
				);
			}

			const rows = this.findElements(container, '.tree-item-self');
			if (rows.length === 0) continue;

			const depths = rows.map((row) => this.countChildAncestors(row, container));
			const rootDepth = Math.min(...depths);

			rows.forEach((row, index) => {
				const depth = depths[index];
				if (depth === undefined) return;
				row.style.setProperty(
					'--overlay-tree-offset',
					`${Math.max(0, depth - rootDepth) * INDENT_PX}px`,
				);
			});
		}
	}

	private findElements(root: ParentNode, selector: string): HTMLElement[] {
		return Array.from(root.querySelectorAll(selector)).filter(
			(element): element is HTMLElement => element.instanceOf(HTMLElement),
		);
	}

	private countChildAncestors(row: HTMLElement, root: HTMLElement): number {
		let depth = 0;

		for (
			let element = row.parentElement;
			element && element !== root;
			element = element.parentElement
		) {
			if (element.classList.contains('tree-item-children')) {
				depth += 1;
			}
		}
		if (row.classList.contains('tree-item-children')) {
			depth += 1;
		}

		return depth;
	}
}
