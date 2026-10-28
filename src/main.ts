import { Plugin } from 'obsidian';
import { registerFileIconsFeature } from './features/file-icons';
import { openThemePicker, registerThemePickerFeature } from './features/theme-picker';

export default class OverlayPlugin extends Plugin {
	async onload(): Promise<void> {
		this.setHeaderAndRibbonVisibility(false);
		registerFileIconsFeature(this);
		await registerThemePickerFeature(this);
	}

	onUserEnable(): void {
		void openThemePicker(this.app.workspace);
	}

	onunload(): void {
		this.setHeaderAndRibbonVisibility(true);
	}

	private setHeaderAndRibbonVisibility(isVisible: boolean): void {
		const vault = this.app.vault as unknown as {
			setConfig: (key: "showViewHeader" | "showRibbon", value: boolean) => void;
		};
		vault.setConfig("showViewHeader", isVisible);
		vault.setConfig("showRibbon", isVisible);
	}
}
