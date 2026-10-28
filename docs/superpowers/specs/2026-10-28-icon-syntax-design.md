# Overlay inline icon syntax — design

## Goal

Let a note author write `%"lucide-name"%` to render a single icon inside a box
that matches the checklist checkbox. Clicking the box opens a searchable,
paginated icon picker; choosing an icon rewrites the syntax in the note and
saves it. The behavior is identical in Reading view and Live Preview.

## Non-goals

- Icon size, color, or label arguments in the syntax.
- Recent or favorite icon lists.
- Uploading custom icons; the picker lists registered icons only.
- Escaping a literal `%"..."%` sequence.

## Syntax

Tokens match `/%"([^"%\n]+)"%/g`. The captured name is trimmed; lookup uses the
exact ID first and the lowercase ID second. Anything between the quotes is a
candidate icon ID.

Examples:

```md
Task done %"circle-check"%
Open folder %"folder-open"%
```

Tokens inside frontmatter, fenced code, inline code, math, and raw HTML are not
rendered.

An unknown name renders the box with `help-circle` and a tooltip containing the
missing ID. The box remains clickable so the name can be replaced.

## Architecture

New feature module under `src/features/icon-syntax/`:

```text
index.ts         registers the markdown post-processor and editor extension
icon-box.ts      builds the shared box element and wires pointer/keyboard input
picker-modal.ts  search, pagination, and icon selection
source-edit.ts   locates a token and rewrites it in the active note
```

`src/main.ts` calls `registerIconSyntaxFeature(this)`. No plugin settings are
stored; the note text is the only state.

The module depends on `obsidian` only. Live Preview uses the CodeMirror
packages already externalized by the build (`@codemirror/state`,
`@codemirror/view`).

## Rendering

### Shared box

`icon-box.ts` exports `createIconBox(name, onActivate)`. It returns a
`span.overlay-icon-box` with:

- `setIcon` output for a valid name, or `help-circle` for an unknown name.
- `data-icon-name` with the raw parsed name.
- `role="button"`, `tabindex="0"`, and an `aria-label` such as
  `Replace icon folder-open`.
- Click and `Enter`/`Space` activation through `onActivate`.

### Reading view

`plugin.registerMarkdownPostProcessor` walks text nodes and replaces each token
with `createIconBox`. It skips nodes inside `code`, `pre`, and math containers.
During a render, the module keeps a per-section counter keyed by the raw token so
each box knows its occurrence index among identical tokens in that section.

### Live Preview

`plugin.registerEditorExtension` installs a `ViewPlugin` that scans visible
ranges for tokens and builds a `DecorationSet`.

- A token is replaced by a widget when the cursor and selection do not intersect
  it.
- When the cursor or selection touches the token, no decoration is emitted, so
  the raw syntax stays visible and editable.
- Ranges inside code, inline code, math, and frontmatter are skipped using the
  syntax tree when available.
- The widget builds the same `span.overlay-icon-box` and opens the picker on
  activation; it validates its stored offsets before applying a change.

## Picker

`IconPickerModal` extends Obsidian's `Modal`.

- Title: “Choose an icon”.
- A search input filters `getIconIds()` by case-insensitive substring. A query
  also matches when the `lucide-` prefix is removed.
- Results are sorted alphabetically and split into pages of 60.
- The grid is responsive (`auto-fill`, minimum tile width around 72px). Each
  tile shows the icon and its truncated name; the active icon is outlined.
- Footer controls: **Previous**, **Next**, and “Page X of Y”; buttons disable at
  the first and last page.
- A query resets the page to 1. A query with no matches shows an empty state.
- Clicking a tile, or pressing `Enter` on it, selects the icon and closes the
  modal. The search field is focused when the modal opens.
- Only one picker may be open at a time.

## Persistence

### Live Preview

The widget stores its source `from`/`to` offsets. On selection it dispatches a
CodeMirror change replacing that range with `%"<new-name>"%`. The editor marks
the file dirty and handles saving.

Before dispatching, the widget checks that the current document still contains
the original token at those offsets. If not, it writes nothing and shows a
notice.

### Reading view

Each box stores its section (`getSectionInfo`) and its occurrence index for that
token. On selection, `source-edit.ts` reads the file through `vault.process`,
locates the Nth occurrence of the raw token inside that section, replaces it with
`%"<new-name>"%`, and saves. The clicked box updates its icon immediately.

If the section info is unavailable, or the occurrence no longer exists, nothing
is written and a notice explains that the syntax changed.

## Styling

Added to `styles.css`:

- `.overlay-icon-box` — `inline-flex`, centered, 22px content plus a 1px border,
  `border-radius: var(--radius-s)`, `background: var(--overlay-canvas)`, border
  `var(--background-modifier-border)`, `color: var(--text-normal)`,
  `vertical-align: middle`, `cursor: pointer`.
- The icon glyph is 14×14 with Obsidian's `.svg-icon` stroke defaults.
- Hover changes the border to `--background-modifier-border-hover`.
- `:focus-visible` adds a 2px accent outline with offset.
- Picker tiles reuse the same box visual and add an accent outline for the
  current icon.

## Error handling

- Unknown icon: `help-circle` fallback, tooltip, still clickable.
- File write failure: catch and show an Obsidian `Notice` with the reason.
- Token no longer present at apply time: no write, notice shown.
- Missing section info in Reading view: no write, notice shown.

## Testing

- Add Vitest as a dev dependency for pure helpers:
  - token parsing and trimming
  - lowercase fallback lookup
  - page slicing and total page count
  - Nth-occurrence replacement inside a section
- Manual checks in Obsidian for Reading view, Live Preview, cursor reveal, modal
  search, pagination, and persistence.
- A headless-Chrome layout check for the box size and alignment against the
  checklist checkbox.

## Limitations

- Duplicate identical tokens in one Reading-view section are resolved by
  occurrence order; edits made outside Overlay between render and selection can
  invalidate that order.
- There is no escape sequence for showing a literal `%"..."%`.
- The picker reflects the icons registered in the running Obsidian version, not
  the current Lucide website.
