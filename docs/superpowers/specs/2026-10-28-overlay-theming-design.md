# Overlay theming — design

Date: 2026-10-28
Status: approved for planning
Plugin: Overlay (`overlay`)

## Purpose

Give Overlay four hand-made color designs, each shipped with a light and a dark
palette. A picker in the left sidebar lists the four designs as cards. Selecting
a card repaints the app through Obsidian's own CSS custom properties, so
Obsidian and third-party plugins recolor coherently without per-component
overrides.

## Non-goals

- Custom text, accent, or syntax-highlighting colors. Text keeps Obsidian's
  normal values for the active mode.
- Per-note or per-folder themes. One design applies vault-wide.
- A color editor. The palettes are authored in source.
- A "no theme" card. Disabling the plugin restores Obsidian's normal
  appearance.
- Changing the existing ribbon/view-header hiding behavior.

## Theme registry

`src/features/theme-picker/themes.ts` is the single source of truth. The picker and the generated
stylesheet both read from it.

```ts
export const THEME_MODES = ["light", "dark"] as const;
export type ThemeMode = typeof THEME_MODES[number];

export interface Palette {
	/** App canvas: space around the note card, sidebar, tab bar. */
	background: string;
	/** The centered markdown card. */
	zone: string;
	/** 1px outline on the card's left and right edges. */
	border: string;
}

export interface ThemeDesign {
	/** Stable persistence key; never renamed. */
	id: string;
	/** Display name. */
	name: string;
	light: Palette;
	dark: Palette;
}

export const THEME_DESIGNS: readonly ThemeDesign[];
```

### Designs

Light/dark pairs are matched by color family.

| id          | name      | mode  | background | zone      | border    |
| ----------- | --------- | ----- | ---------- | --------- | --------- |
| `parchment` | Parchment | light | `#F4F1EA`  | `#FBFAF5` | `#E0DED6` |
| `parchment` | Parchment | dark  | `#16150F`  | `#1F1D16` | `#2D2D2D` |
| `sage`      | Sage      | light | `#E3EBDD`  | `#F2F7EF` | `#CFD9C9` |
| `sage`      | Sage      | dark  | `#14160F`  | `#1C1F16` | `#2D2D2D` |
| `tide`      | Tide      | light | `#DDEAF5`  | `#F0F6FC` | `#C8D7E5` |
| `tide`      | Tide      | dark  | `#0F1613`  | `#161F1C` | `#2D2D2D` |
| `slate`     | Slate     | light | `#E4E3ED`  | `#F3F2F8` | `#D1CFDE` |
| `slate`     | Slate     | dark  | `#140F16`  | `#1C161F` | `#2D2D2D` |

Default design: `parchment`.

## How the colors reach the screen

Two layers, both generated from `THEME_DESIGNS`.

### Layer 1 — palette values

One rule per design per mode, keyed off an attribute on `<body>`:

```css
body[data-overlay-theme="parchment"].theme-light {
	--overlay-canvas: #f4f1ea;
	--overlay-zone: #fbfaf5;
	--overlay-zone-border: #e0ded6;
}

body[data-overlay-theme="parchment"].theme-dark {
	--overlay-canvas: #16150f;
	--overlay-zone: #1f1d16;
	--overlay-zone-border: #2d2d2d;
}
```

Both mode blocks are always present. Toggling Obsidian's light/dark setting
swaps palettes with no JavaScript involvement.

### Layer 2 — mapping to Obsidian

One shared rule maps the three Overlay colors onto documented Obsidian surface
variables:

```css
body[data-overlay-theme] {
	--background-primary: var(--overlay-zone);
	--background-secondary: var(--overlay-canvas);
	--background-secondary-alt: var(--overlay-canvas);
	--background-modifier-border: var(--overlay-zone-border);
	--background-modifier-border-hover: var(--overlay-zone-border);
	--background-modifier-border-focus: var(--overlay-zone-border);
	--divider-color: var(--overlay-zone-border);
}
```

Rationale: Obsidian's hover, selection, menu, and shadow layers are translucent
overlays on these surfaces, so they keep working on any background. These
variables are documented in the Obsidian developer docs under
*Reference → CSS variables → Foundations → Colors*.

`--background-primary-alt` (code blocks and other small surfaces) is left at
Obsidian's default for now. Revisit after seeing it live.

### Specificity

`body[data-overlay-theme="…"].theme-light` is more specific than Obsidian's
`body.theme-light` and than typical community-theme selectors, so the palette
wins without `!important`. The stylesheet is injected after Obsidian's own
styles, which also helps.

## The note card

Obsidian has no variable for the centered card, so `styles.css` adds it. The
card keeps the existing `1071px` cap and `1cm 2cm` padding from the current
`styles.css`.

```css
/* Space around the card uses the canvas color. */
.workspace-leaf-content[data-type="markdown"] .view-content,
.markdown-preview-view,
.view-content > .markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller {
	background-color: var(--overlay-canvas);
}

/* The card itself. */
.markdown-reading-view > .markdown-preview-view > .markdown-preview-sizer,
.markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller > .cm-sizer {
	background-color: var(--overlay-zone);
	border-left: 1px solid var(--overlay-zone-border);
	border-right: 1px solid var(--overlay-zone-border);
}
```

Square corners, no shadow, no top/bottom border: a full-height sheet with side
edges only.

## Mode synchronization

- Clicking the light half of a card applies the design and sets Obsidian to
  light mode. Clicking the dark half applies it and sets dark mode.
- Mode is changed with `app.vault.setConfig("theme", "moonstone" | "obsidian")`:
  use `"moonstone"` for light mode and `"obsidian"` for dark mode.
  This is the same value Obsidian writes to `appearance.json`; Obsidian updates
  its own state, its Appearance settings UI, and all dependent styles.

  `setConfig` is not part of the typed public API. The plugin already uses it
  for `showViewHeader` and `showRibbon`, so a small typed wrapper with a cast is
  acceptable. No DOM class manipulation.

- Nothing listens for mode changes. The switcher and the picker only *read* the
  current mode (`document.body.classList.contains("theme-dark")`) to highlight
  the active half.

- Consequence: selecting a theme is a real appearance change. If the user later
  flips light/dark with Obsidian's own control, the same design's other palette
  applies. Disabling the plugin leaves the mode where it was.

## Picker view

A custom `ItemView` in the left sidebar, opened once on first enable so its
icon appears in the sidebar tab strip next to Files, Search, and Bookmarks.

- View type: `overlay-theme-picker`.
- Display text: `Themes`.
- Icon: `swatch-book`.
- Opening: `workspace.getLeftLeaf(false)` + `setViewState`, then `revealLeaf`.
  Reuse an existing leaf found with `workspace.getLeavesOfType`.
- Entry points:
  1. The sidebar tab (primary).
  2. Command `overlay:open-theme-picker` — "Open theme picker".
- `onUserEnable()` opens the view once, per Obsidian's documented guidance for
  plugins that register a view.

### Panel contents

- View header rendered by Obsidian (`getDisplayText`).
- List of four cards, one per design, stacked vertically.
- Card header: design name.
- Two equal preview halves side by side: light on the left, dark on the right.
- Each half renders a miniature of the real result: canvas color fill, a smaller
  centered rectangle in the zone color, and 1px side borders in the border
  color.
- Each half has a caption: `Light` / `Dark`.
- Active half: accent-colored outline plus a check icon.
- Halves are real `<button>` elements with `aria-pressed`, keyboard focus, and
  hover states. Clicking anywhere in a half applies that design and mode.
- The whole panel re-renders its active state when the theme changes or the mode
  changes (listen to `css-change` on `workspace`, plus our own apply call).

### Styling

Panel CSS lives in `styles.css` under an `overlay-theme-picker` prefix. The
picker uses Obsidian variables for its own chrome (spacing, borders, accent) so
it stays readable in every theme, including other community themes.

## Persistence and lifecycle

- `loadData()` / `saveData()` store `{ themeId: string }`.
- Unknown or missing `themeId` falls back to `parchment`.
- On load: read settings, inject the generated stylesheet into the main
  document, set `document.body.dataset.overlayTheme`.
- On selection: update settings, set the attribute, save, refresh the view.
- Pop-out windows: the stylesheet is injected into each new window through
  `workspace.on("window-open", …)`. The body attribute is set in that document
  too.
- On unload: remove the injected `<style>`, remove the attribute, unregister the
  view. Obsidian's own appearance (including the mode we set) remains.
- The plugin's existing startup behavior (hiding the ribbon and view header)
  stays unchanged and is unrelated to this feature.

## Files

```
src/
  main.ts                       # plugin lifecycle and feature registration
  features/
    theme-picker/
      index.ts                  # theme feature behavior, view, and lifecycle
      themes.ts                 # ThemeMode, Palette, ThemeDesign, THEME_DESIGNS
styles.css         # card rules + picker styles
```

Each file stays under roughly 200 lines. No new dependencies.

## Testing

No automated test runner exists in this repo, and this feature is overwhelmingly
DOM/CSS. Verification is:

1. `npm run build` passes (`tsc --noEmit` plus esbuild).
2. `npm run lint` passes.
3. Manual checklist in a real vault:
   - [ ] Fresh enable opens the picker tab in the left sidebar with a `swatch-book` icon.
   - [ ] Command palette can open it after closing the tab.
   - [ ] Four cards render with the exact palette colors.
   - [ ] Clicking each light half switches to light mode and repaints canvas, note card, sidebar, tab bar, and borders.
   - [ ] Clicking each dark half does the same in dark mode.
   - [ ] Obsidian's own light/dark toggle swaps to the paired palette without re-clicking.
   - [ ] Side borders show on the note card; no top/bottom border; width stays capped.
   - [ ] Reading view and Live Preview agree.
   - [ ] Reload the app: same design, correct mode, still themed.
   - [ ] Disable the plugin: all Overlay colors disappear, Obsidian looks normal.
   - [ ] Re-enable: previous design returns.
   - [ ] Pop-out window is themed.
   - [ ] Hover, selection, menus, code blocks, and a third-party plugin's panel remain readable.

## Risks

- `vault.setConfig("theme", …)` is undocumented. If a future Obsidian version
  changes the appearance key, mode switching breaks while theming still works.
  The fallback is to toggle `theme-light`/`theme-dark` on `<body>`, which is
  less clean and would need a mode-change listener.
- A community theme that sets surface variables with `!important` would win.
  Accepted: Overlay is meant to be the theme in use.
- Brief unstyled flash on startup before the stylesheet injects. Accepted;
  injection happens before layout settles.
- The picker preview is a miniature, not a live iframe; it approximates the
  note card proportions.

## Acceptance criteria

- Four designs, each with light and dark palettes, defined only in `src/features/theme-picker/themes.ts`.
- Switching designs and modes updates the whole app through Obsidian CSS
  variables, with no per-component color overrides beyond the note card.
- Clicking a card half switches Obsidian's real light/dark mode.
- The sidebar tab, the command, and persistence all work as described.
- `npm run build` and `npm run lint` pass.
- The manual checklist passes.
