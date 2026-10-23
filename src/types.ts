export interface PluginFeature {
	register(): void;
	unregister(): void;
}
