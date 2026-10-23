import { Platform } from 'obsidian';
import type { PluginFeature } from './types';

const MINIMAL_UI_CLASS = 'overlay-minimal-ui';

/**
 * Hides the view header (breadcrumbs, edit/preview toggle, and more options)
 * and the status bar.
 */
export class MinimalUi implements PluginFeature {
	register(): void {
		if (!Platform.isDesktopApp) return;

		document.body.addClass(MINIMAL_UI_CLASS);
	}

	unregister(): void {
		document.body.removeClass(MINIMAL_UI_CLASS);
	}
}
