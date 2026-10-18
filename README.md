# Overlay

Overlay is an Obsidian plugin for a custom theme and extra Markdown elements in your notes.

## Development

- Install dependencies with `npm install`.
- Run `npm run dev` to build in watch mode.
- Run `npm run build` to create a production build.

The plugin entry point is `src/main.ts`. The current source contains only the plugin scaffold; theme and Markdown features can be added there or in focused modules under `src/` as they are implemented.

## Installing locally

Build the plugin, then ensure `main.js`, `manifest.json`, and `styles.css` are in the `overlay` plugin folder in your vault. Reload Obsidian and enable **Overlay** in **Settings → Community plugins**.
