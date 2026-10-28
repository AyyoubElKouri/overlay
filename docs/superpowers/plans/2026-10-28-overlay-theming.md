# Overlay theming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four persisted Overlay color designs with light and dark palettes, a sidebar picker, and app-wide recoloring through Obsidian surface variables.

**Architecture:** Keep all theme picker behavior in `src/features/theme-picker/`, with one feature entry point that owns settings, view/command registration, document styling, and events. `main.ts` stays focused on plugin lifecycle and delegates feature setup with one call.

**Tech Stack:** TypeScript, Obsidian Plugin and ItemView APIs, CSS custom properties, esbuild, ESLint.

**Spec:** `docs/superpowers/specs/2026-10-28-overlay-theming-design.md`

## Global Constraints

- Define four designs, each with light and dark palettes, only in `src/features/theme-picker/themes.ts`.
- Default design is `parchment`; unknown or missing `themeId` falls back to `parchment`.
- Map `--overlay-zone` to `--background-primary`, `--overlay-canvas` to `--background-secondary` and `--background-secondary-alt`, and `--overlay-zone-border` to the three documented border variables and `--divider-color`.
- Leave `--background-primary-alt`, text, accent, and syntax-highlighting colors at Obsidian defaults.
- Keep the centered card's `1071px` cap and `1cm 2cm` padding; add only left/right borders, with square corners and no shadow.
- Selecting a card half applies the design and changes Obsidian's real mode through `vault.setConfig("theme", "moonstone" | "obsidian")` (`moonstone` for light, `obsidian` for dark); do not manipulate mode classes.
- Use a single vault-wide design; do not add a color editor, a no-theme card, or per-note/per-folder behavior.
- Preserve the current ribbon and view-header hiding behavior.
- Store `{ themeId: string }` through `loadData()` and `saveData()`; remove Overlay theme injection and the body attribute on unload, while leaving the selected Obsidian mode unchanged.
- Register and clean up view, event, and DOM resources through Obsidian lifecycle helpers where available.
- Add no dependencies. Keep each new source file under roughly 200 lines.
- Verify with `npm run build`, `npm run lint`, and the spec's real-vault manual checklist.

## Review Focus

- Missing, unknown, or stale persisted theme IDs must recover to `parchment`; verify on fresh enable and with invalid saved data.
- Switching modes through Obsidian must select the matching palette without a second click; verify in the real-vault light/dark toggle checklist.
- A newly opened pop-out window must receive both generated CSS and the active body attribute; verify the pop-out checklist and confirm unload removes the injection.
- Repeatedly opening the picker or applying a design must not create duplicate views, style elements, or listeners; verify by reopening and reloading in the manual checklist.
- Picker controls must remain keyboard-operable and expose the active half through `aria-pressed`; verify focus, keyboard activation, and active indication in the real vault.

---

### Task 1: Define the theme registry and CSS generator

**Files:**
- Create: `src/features/theme-picker/themes.ts`
- Modify: `src/features/theme-picker/index.ts`

**Interfaces:**
- `src/features/theme-picker/themes.ts` exports `ThemeMode`, `Palette`, `ThemeDesign`, and readonly `THEME_DESIGNS` exactly as specified, with the four exact IDs, names, and color values.
- `src/features/theme-picker/index.ts` keeps the fallback lookup and generated stylesheet private to the feature implementation.

- [ ] **Step 1: Add the typed theme registry**

Define the three interfaces/types and four immutable designs in `src/features/theme-picker/themes.ts`. Store all palette values in lowercase hex as shown in the spec; keep `parchment` first and the default fallback explicit.

- [ ] **Step 2: Implement the design lookup and stylesheet generator**

In `src/features/theme-picker/index.ts`, generate selectors of the form `body[data-overlay-theme="<id>"].theme-light` and `.theme-dark` from `THEME_DESIGNS`; emit the shared mapping to the exact Obsidian variables in the spec.

- [ ] **Step 3: Review generated selector and token coverage against the spec**

Check that all eight design/mode combinations are generated and the shared rule maps only the seven specified surface/border properties. Keep `--background-primary-alt` out of the generated mapping.

**Deliverable:** One source of truth for all palette values and a deterministic stylesheet generator used by later tasks.

### Task 2: Apply and persist the active theme across app windows

**Files:**
- Modify: `src/features/theme-picker/index.ts`
- Modify: `src/main.ts`

**Interfaces:**
- `src/features/theme-picker/index.ts` exports `registerThemePickerFeature(plugin: Plugin): Promise<void>` and owns settings, view/command registration, theme application, and feature resources.
- `src/main.ts` calls `registerThemePickerFeature(this)` and keeps only plugin lifecycle plus the existing ribbon/header behavior.

- [ ] **Step 1: Add persisted settings defaults**

In `registerThemePickerFeature`, load `themeId`, default it to `parchment`, and normalize it with `getThemeDesign` before applying it.

- [ ] **Step 2: Add idempotent document-level style management**

Keep document injection in the feature entry point. Use one stable style-element ID, update an existing element instead of appending a duplicate, and set/remove `data-overlay-theme` on each document's body.

- [ ] **Step 3: Wire lifecycle, settings persistence, and mode application**

In `src/features/theme-picker/index.ts`, apply the saved design to the main document. Its `applyTheme(themeId, mode?)` normalizes the ID, updates all themed documents, optionally calls the typed `setConfig` wrapper, persists `{ themeId }`, and refreshes the picker if it is open. Register the `window-open` handler with `registerEvent`. Keep `main.ts` limited to calling `registerThemePickerFeature(this)` during load.

- [ ] **Step 4: Clean injected state on unload**

Track each document receiving injected CSS, including pop-out documents, and register a cleanup callback that removes the style element and body attribute from each on plugin unload. Preserve the existing `setHeaderAndRibbonVisibility` calls and do not restore the prior light/dark mode.

**Deliverable:** Loading, selecting, and unloading themes updates the main and pop-out documents without duplicate injected styles and persists the selected design.

### Task 3: Build the theme picker view and command

**Files:**
- Modify: `src/features/theme-picker/index.ts`

**Interfaces:**
- `ThemePickerView` in `src/features/theme-picker/index.ts` receives the leaf and an `applyTheme(themeId: string, mode: ThemeMode): Promise<void>` callback.
- `ThemePickerView` exposes `refresh(): void`, returns `"overlay-theme-picker"` from `getViewType()`, and returns `"Themes"` from `getDisplayText()`.
- The feature entry point registers command ID `overlay:open-theme-picker` with name `Open theme picker`.

- [ ] **Step 1: Implement the card view and active-state rendering**

Build four vertically stacked cards from `THEME_DESIGNS`. Each card has its design name and two equal real `<button>` previews, light on the left and dark on the right. Each preview renders canvas, a smaller centered zone, side borders, a caption, `aria-pressed`, and an active outline/check when its design and current body mode match. Read current mode from `document.body.classList.contains("theme-dark")` and re-render after a selection.

- [ ] **Step 2: Register the view and handle opening/reuse**

Register `VIEW_TYPE_THEME_PICKER` with an `ItemView` factory. Add an open helper that reuses a leaf from `workspace.getLeavesOfType`; otherwise call `workspace.getLeftLeaf(false)`, set view state, then reveal the leaf. On first user enable, open the view once as documented in the spec.

- [ ] **Step 3: Add the stable command entry point**

Register `overlay:open-theme-picker` in the feature entry point and invoke the same open helper as the sidebar flow.

- [ ] **Step 4: Refresh on theme and mode changes**

Subscribe through `registerEvent` to workspace `css-change` and refresh an existing picker view. Refresh after the plugin's own `applyTheme` call as well. Account for deferred views by revealing before assuming the leaf contains a live `ThemePickerView` instance.

**Deliverable:** Users can open the picker from the left sidebar or command palette, select either mode for any design, and see the active half update accessibly.

### Task 4: Style previews and the centered note card

**Files:**
- Modify: `styles.css`

**Interfaces:**
- CSS palette variables are provided by `buildThemeCss()` from Task 1; this file must not duplicate palette hex values.
- Picker styles use an `overlay-theme-picker` prefix and Obsidian variables for spacing, borders, accent, and text.

- [ ] **Step 1: Add app canvas and note card surfaces**

Apply `var(--overlay-canvas)` to the markdown workspace content, reading view, and Live Preview scroller selectors from the spec. Apply `var(--overlay-zone)` and one-pixel left/right `var(--overlay-zone-border)` borders to the reading and Live Preview sizers. Preserve current width and padding rules; do not add top/bottom borders, rounded corners, or shadows.

- [ ] **Step 2: Add picker card and preview styles**

Style card layout, equal side-by-side previews, miniature centered zone, caption, hover/focus states, active accent outline, and check icon under the picker prefix. Use Obsidian UI variables so the picker remains readable under other community themes.

- [ ] **Step 3: Check selector overlap with existing layout rules**

Confirm the new rules compose with the existing `1071px` centered sizer, `1cm 2cm` padding, scroll container, and top-bar behavior. Remove or update only declarations that directly conflict with the spec's card treatment.

**Deliverable:** Reading view and Live Preview show matching canvas/card surfaces, and the sidebar previews inherit Obsidian-native chrome styling.

### Task 5: Build, lint, and complete real-vault verification

**Files:**
- Review: `src/main.ts`, `src/features/theme-picker/index.ts`, `src/features/theme-picker/themes.ts`, `styles.css`

- [ ] **Step 1: Build the plugin**

Run `npm run build`.
Expected: TypeScript and esbuild finish successfully and produce the normal root release bundle.

- [ ] **Step 2: Lint the plugin**

Run `npm run lint`.
Expected: ESLint exits successfully without errors.

- [ ] **Step 3: Verify the documented Obsidian APIs and view behavior**

Confirm `ItemView` registration/opening, `css-change`, and each CSS variable used for app surfaces against current official docs. Keep the `vault.setConfig("theme", …)` cast localized because the spec identifies it as an untyped API.

- [ ] **Step 4: Complete the real-vault manual checklist**

Run every checklist item in the spec: fresh-enable view and icon, command reopening, exact card palettes, each light/dark selection, Obsidian mode toggle, card width/borders, Reading/Live Preview agreement, reload persistence, disable/reenable cleanup, pop-out styling, and readability of hover/selection/menus/code blocks/third-party panels.

**Deliverable:** Build and lint pass, and all specified manual acceptance checks are recorded as complete.
