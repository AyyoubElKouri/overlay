# Architecture

## Goals

- Keep `main.ts` limited to the plugin lifecycle.
- Put each behavior in a focused, reversible feature.
- Allow new features without editing `main.ts`.

## File layout

```
src/
  main.ts             Plugin entry point and lifecycle only
  features.ts         Feature registry
  types.ts            Shared PluginFeature contract
  globals.d.ts        Build-time constants (__DEV__)
  svg.d.ts            Type declaration for imported SVG assets
  sidebar-icons.ts    SVG assets exposed as CSS variables
  sidebar-toggle.ts   Sidebar chrome removal and toggle button
  auto-hide-tabs.ts   Hover-reveal behavior for the main tab bar
  minimal-ui.ts       View header removal and status bar auto-hide
  theme-styles.ts     Loads minimal.css as a constructed stylesheet
  assets/check.svg    Checkmark icon used by checklist boxes
minimal.css           Theme colors, typography, and component styling
styles.css            Structural plugin styles
```

## Lifecycle

1. Obsidian creates `OverlayPlugin`.
2. The plugin creates `PluginFeatures` with itself as the argument.
3. `onload` calls `features.register()`.
4. `onunload` calls `features.unregister()`.

```
OverlayPlugin.onload()
  └── PluginFeatures.register()
        └── feature.register() for each feature

OverlayPlugin.onunload()
  └── PluginFeatures.unregister()
        └── feature.unregister() for each feature
```

`main.ts` therefore stays the same size as the number of features grows.

## Feature contract

Every feature implements `PluginFeature` from `src/types.ts`:

```ts
export interface PluginFeature {
	register(): void;
	unregister(): void;
}
```

- `register()` adds commands, listeners, DOM elements, and CSS classes.
- `unregister()` reverses every change made by `register()`.

Use the plugin registration helpers where possible. Events registered with
`plugin.registerEvent` are cleaned up automatically. Manual DOM nodes, body
classes, and observers need explicit cleanup in `unregister()`.

## Adding a feature

1. Create a class in `src/` that implements `PluginFeature`.
2. Accept the `Plugin` instance in the constructor when the feature needs it.
3. Register all listeners and DOM changes in `register()`.
4. Remove every change in `unregister()`.
5. Add the class to the `features` array in `src/features.ts`.

```ts
// src/my-feature.ts
import { Plugin } from 'obsidian';
import type { PluginFeature } from './types';

export class MyFeature implements PluginFeature {
	private readonly plugin: Plugin;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
	}

	register(): void {
		// Add listeners, commands, DOM, and CSS.
	}

	unregister(): void {
		// Reverse everything added by register().
	}
}
```

```ts
// src/features.ts
this.features = [new SidebarToggle(plugin), new MyFeature(plugin)];
```

`main.ts` does not change.

## Current feature: sidebar toggle

`SidebarToggle` simplifies the left sidebar:

- Adds `overlay-clean-sidebar` to `document.body`.
- The CSS class hides the left ribbon and the left sidebar tab bar, and sets
  `--ribbon-width` to `0`.
- Inserts a toggle button into the file explorer action row, before the new
  note and new folder buttons.
- Re-inserts the button after layout changes, such as when the file explorer
  view is recreated.
- Registers `overlay:toggle-left-sidebar` as a command-palette fallback.
- Removes the body class and toggle buttons on unload.

The toggle button only exists while the file explorer is visible. When the
sidebar is collapsed, use the `Toggle left sidebar` command to reopen it.

Hiding the sidebar tab bar also hides the Files, Search, and Bookmarks tab
buttons. This is intentional for the minimal layout.

## Current feature: auto-hide main tab bar

`AutoHideTabs` hides the main tab bar and reveals it on demand:

- Adds `overlay-autohide-tabs` to `document.body`.
- The CSS class moves the main tab bar above the viewport edge and removes it
  from the layout, so the editor gains the vertical space.
- A transparent hover zone at the top edge of each main tab group detects the
  pointer.
- Hovering the zone adds `overlay-tabs-visible`, which slides the tab bar down
  with a CSS transition.
- Hovering the tab bar keeps it open. Leaving the bar starts a short delay
  before hiding it again.
- Layout changes rebuild the hover zones and rebind the tab bar listeners.

The feature is desktop-only. On mobile, `register()` returns early and the
layout stays unchanged.

## Current feature: minimal UI

`MinimalUi` removes the remaining editor chrome:

- Adds `overlay-minimal-ui` to `document.body`.
- Hides the main view header, including breadcrumbs, the edit/preview toggle,
  and the more-options menu.
- Leaves the status bar in the layout but makes it transparent. Hovering the
  bottom-right status bar area fades it back in.

The feature is desktop-only. `unregister()` removes the body class, restoring
the header and the permanent status bar.

## Styling

Scope plugin CSS to a body class owned by the feature:

```css
body.overlay-clean-sidebar {
	--ribbon-width: 0px;
}
```

A body class makes the change reversible: removing the class restores the
default Obsidian layout. Prefer selectors based on documented Obsidian classes
and keep `!important` as a last resort.

## Theme stylesheet

`ThemeStyles` applies `minimal.css` through a constructed stylesheet added to
`document.adoptedStyleSheets`. Obsidian keeps its own injection of `styles.css`,
so the two files stay separate.

Production builds bundle `minimal.css` into `main.js`. This is required because
Obsidian only installs `main.js`, `manifest.json`, and `styles.css` from a
release; a separate theme file would not reach community-plugin installs.

Builds made with `npm run dev` set the compile-time constant `__DEV__` to
`true` and read `minimal.css` from the plugin folder, polling it once per second
and replacing the sheet contents when its mtime or size changes. Theme edits
then appear without reloading the plugin. If the file is missing, the bundled
stylesheet is used instead.

Builds made with `npm run build` set `__DEV__` to `false`; the poller and file
read are eliminated from the bundle, and the command re-applies the bundled
stylesheet.

`styles.css` is injected by Obsidian itself and is not hot-reloaded. TypeScript
changes always require a plugin reload; use `npm run dev` together with the
**Hot Reload** community plugin for that.

## File explorer

The sidebar restyles Obsidian's file explorer into rounded rows:

- Each folder and file title becomes a pill with a folder or document icon.
- Folder rows show an expand/collapse chevron at the trailing edge.
- Markdown files show an `MD` badge.
- Nested rows keep Obsidian's indentation guides, recoloured to match.

The SVG files in `src/assets/` are bundled as text by esbuild
(`loader: { '.svg': 'text' }`). `SidebarIcons` converts them to data URIs and
publishes them as CSS variables (`--overlay-icon-*`) on `document.body`, so the
stylesheet never needs to resolve asset paths at runtime. `unregister()`
removes the variables.

`minimal.css` contains the selectors. They are scoped to
`.workspace-leaf-content[data-type="file-explorer"]` or `.nav-files-container`
so other tree views keep their default styling.

## Layout zones

### Right markdown zone

The **right markdown zone** is the editor area to the right of the left
sidebar. It is the primary writing surface and is shared by both markdown view
modes.

The scroll containers (`.markdown-preview-view` and `.cm-scroller`) stay
full width so their scrollbars sit at the window edge. The visible zone is the
inner content wrapper:

| Mode         | Zone selector                                                                 |
| ------------ | ----------------------------------------------------------------------------- |
| Reading      | `.markdown-preview-view > .markdown-preview-sizer`                            |
| Editing      | `.markdown-source-view.mod-cm6 > .cm-editor > .cm-scroller > .cm-sizer`       |

Both targets use the same variables:

| Variable                                  | Default | Purpose                    |
| ----------------------------------------- | ------- | -------------------------- |
| `--overlay-markdown-zone-width`           | `1071px`| Maximum zone width         |
| `--overlay-markdown-zone-padding-top`     | `1cm`   | Top padding                |
| `--overlay-markdown-zone-padding-inline`  | `2cm`   | Left and right padding     |

The zone is full-width up to its maximum, then centered. Readable line width is
disabled inside the zone so the width variable controls the layout. The bottom
padding is left at Obsidian's default.

Use these variables when adding later components that must align with the
markdown content.

### Bottom-right status bar

The status bar is the small floating zone at the bottom-right of the window
(`.status-bar`). It starts transparent and becomes fully visible on pointer
hover. This keeps the mode indicator accessible without permanently occupying
attention.

## Theme layer

`minimal.css` holds theme-only settings. `ThemeStyles` loads it at startup
through `document.adoptedStyleSheets`; Obsidian's CSP blocks external
stylesheet links.

Keep layout and behavior in `styles.css`. Put colors, typography, shadows,
and component styling in `minimal.css`.

### Checklist boxes

Checklist checkboxes are 22×22 with a 6px radius, `#1d1f18` fill, and a
`0.5px` border in `rgba(150, 160, 130, 0.14)`. A checked box shows
`src/assets/check.svg` centered at 12px wide.

The icon is embedded in `minimal.css` as a base64 data URI. Relative URLs in a
constructed stylesheet resolve against the app document, not the plugin folder,
so inlining keeps the icon self-contained.

## Commands

| ID                           | Purpose              |
| ---------------------------- | -------------------- |
| `overlay:toggle-left-sidebar` | Open or close the left sidebar |

Command IDs are stable. Do not rename them after a release.

## Validation

Run both checks before reloading Obsidian:

```bash
npm run lint
npm run build
```

Then reload Obsidian with **Ctrl+R**.
