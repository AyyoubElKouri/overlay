import { Plugin } from 'obsidian';
import { PluginFeatures } from './features';

export default class OverlayPlugin extends Plugin {
	private readonly features = new PluginFeatures(this);

	onload(): void {
		this.features.register();
	}

	onunload(): void {
		this.features.unregister();
	}
}
