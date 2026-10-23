import { Platform, Plugin } from 'obsidian';
import type { PluginFeature } from './types';

const TABS_HIDDEN_CLASS = 'overlay-autohide-tabs';
const TABS_VISIBLE_CLASS = 'overlay-tabs-visible';
const HOVER_ZONE_CLASS = 'overlay-tabs-hover-zone';
const HOVER_BOUND_CLASS = 'overlay-tabs-hover-bound';
const HIDE_DELAY_MS = 180;

/**
 * Hides the main tab bar and reveals it when the pointer reaches the top
 * edge of the main workspace.
 */
export class AutoHideTabs implements PluginFeature {
	private readonly plugin: Plugin;
	private readonly hoverZones = new Set<HTMLElement>();
	private readonly boundHeaders = new Set<HTMLElement>();
	private abortController: AbortController | null = null;
	private hideTimeout: number | null = null;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	register(): void {
		if (!Platform.isDesktopApp) return;

		this.abortController = new AbortController();
		document.body.addClass(TABS_HIDDEN_CLASS);

		this.plugin.app.workspace.onLayoutReady(() => this.syncHoverTargets());
		this.plugin.registerEvent(
			this.plugin.app.workspace.on('layout-change', () => this.syncHoverTargets()),
		);
	}

	unregister(): void {
		const controller = this.abortController;
		if (!controller) return;

		this.abortController = null;
		this.clearHideTimeout();
		controller.abort();

		document.body.removeClass(TABS_HIDDEN_CLASS);
		document.body.removeClass(TABS_VISIBLE_CLASS);

		for (const zone of this.hoverZones) {
			zone.remove();
		}
		this.hoverZones.clear();

		for (const header of this.boundHeaders) {
			header.removeClass(HOVER_BOUND_CLASS);
		}
		this.boundHeaders.clear();
	}

	private syncHoverTargets(): void {
		const controller = this.abortController;
		if (!controller) return;

		const signal = controller.signal;
		const tabGroups = Array.from(
			document.querySelectorAll<HTMLElement>(
				'.workspace-split.mod-root .workspace-tabs.mod-top',
			),
		);

		for (const group of tabGroups) {
			this.addHoverZone(group, signal);
			this.bindTabHeader(group, signal);
		}
	}

	private addHoverZone(group: HTMLElement, signal: AbortSignal): void {
		if (group.querySelector<HTMLElement>(`:scope > .${HOVER_ZONE_CLASS}`)) return;

		const zone = createDiv({ cls: HOVER_ZONE_CLASS });
		group.prepend(zone);
		zone.addEventListener('pointerenter', () => this.showTabs(), { signal });
		zone.addEventListener('pointerleave', (event) => this.onHoverZoneLeave(event), {
			signal,
		});
		this.hoverZones.add(zone);
	}

	private bindTabHeader(group: HTMLElement, signal: AbortSignal): void {
		const header = group.querySelector<HTMLElement>(
			':scope > .workspace-tab-header-container',
		);
		if (!header || header.hasClass(HOVER_BOUND_CLASS)) return;

		header.addClass(HOVER_BOUND_CLASS);
		header.addEventListener('pointerenter', () => this.showTabs(), { signal });
		header.addEventListener('pointerleave', () => this.scheduleHide(), { signal });
		this.boundHeaders.add(header);
	}

	private showTabs(): void {
		this.clearHideTimeout();
		document.body.addClass(TABS_VISIBLE_CLASS);
	}

	private onHoverZoneLeave(event: PointerEvent): void {
		// The tab bar may slide in under a stationary pointer. Keep it open in
		// that case instead of scheduling a hide.
		if (this.isPointInsideTabBar(event.clientX, event.clientY)) return;

		this.scheduleHide();
	}

	private isPointInsideTabBar(x: number, y: number): boolean {
		return document
			.elementsFromPoint(x, y)
			.some((element) => element.closest('.workspace-tab-header-container') !== null);
	}

	private scheduleHide(): void {
		this.clearHideTimeout();
		this.hideTimeout = window.setTimeout(() => {
			this.hideTimeout = null;
			document.body.removeClass(TABS_VISIBLE_CLASS);
		}, HIDE_DELAY_MS);
	}

	private clearHideTimeout(): void {
		if (this.hideTimeout === null) return;

		window.clearTimeout(this.hideTimeout);
		this.hideTimeout = null;
	}
}
