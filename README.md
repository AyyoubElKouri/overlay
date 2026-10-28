# Overlay

Overlay is an Obsidian plugin for a custom theme and extra Markdown elements in your notes.

## Inline icons

Write `%"icon-name"%` in a note to render an icon inside a box that matches the
checklist checkbox. Click the box to open the icon picker, search by name, and
choose a replacement; the note is updated automatically.

Icons available in the picker come from the running Obsidian version. Unknown
names render `help-circle` and stay clickable. The syntax is ignored inside
code, math, and frontmatter.

## Development

- Install dependencies with `npm install`.
- Run `npm run dev` to build in watch mode.
- Run `npm run build` to create a production build.

The plugin entry point is `src/main.ts`. The current source contains only the plugin scaffold; theme and Markdown features can be added there or in focused modules under `src/` as they are implemented.

## Installing locally

Build the plugin, then ensure `main.js`, `manifest.json`, and `styles.css` are in the `overlay` plugin folder in your vault. Reload Obsidian and enable **Overlay** in **Settings → Community plugins**.
