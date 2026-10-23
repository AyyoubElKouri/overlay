# Overlay

Overlay is an Obsidian plugin for a custom theme and extra Markdown elements in your notes.

## Development

- Install dependencies with `npm install`.
- Run `npm run dev` to build in watch mode.
- Run `npm run build` to create a production build.

During development, `minimal.css` is polled once per second and applied in
place, so theme edits appear without reloading the plugin. Use the **Reload
theme styles** command to apply changes manually. JavaScript changes still
require a plugin reload (or the **Hot Reload** community plugin).

Production builds do not include the poller; the reload command remains
available. Structural styles in `styles.css` are injected by Obsidian and are
not hot-reloaded.

The plugin entry point is `src/main.ts`. It handles only the plugin lifecycle and delegates features to `src/features.ts`. See [docs/architecture.md](docs/architecture.md) for the feature architecture and how to add a feature.

## Installing locally

Build the plugin, then ensure `main.js`, `manifest.json`, and `styles.css` are in the `overlay` plugin folder in your vault. Reload Obsidian and enable **Overlay** in **Settings → Community plugins**.
