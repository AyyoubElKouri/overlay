// Bundled SVG assets are imported as their raw markup for CSS mask URLs.
declare module "*.svg" {
	const content: string;
	export default content;
}
