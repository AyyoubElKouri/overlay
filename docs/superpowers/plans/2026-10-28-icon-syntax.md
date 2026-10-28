# Inline Icon Syntax Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `%"icon-name"%` as a themed icon box in Reading view and Live Preview, with a searchable paginated picker that rewrites the token in the note.

**Architecture:** A new `src/features/icon-syntax/` module holds pure helpers (token parsing, pagination, text replacement) and Obsidian-facing units (box factory, picker modal, Reading-view post-processor, CodeMirror extension). `main.ts` registers the feature; `styles.css` owns all visuals.

**Tech Stack:** TypeScript, Obsidian API, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`), esbuild, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-icon-syntax-design.md`

## Global Constraints

- TypeScript `strict`, `noImplicitReturns`, `noUncheckedIndexedAccess`.
- Runtime dependencies stay limited to `obsidian`; CodeMirror packages remain esbuild externals.
- No plugin settings, no network calls, no custom icon upload.
- Page size is exactly 60 icons.
- Token pattern is exactly `/%"([^"%\n]+)"%/g`.
- Icon fallback is `help-circle`.
- All user-facing strings use sentence case.

## Review Focus

- A token inside inline code, a fenced code block, math, or frontmatter must render as text, never as an icon.
- Duplicate identical tokens in one Reading-view section must update the clicked occurrence, not an earlier one.
- In Live Preview, placing the cursor inside a token must reveal the raw syntax instead of the widget.
- An empty or unknown icon name must not produce a blank or crashed box.
- If the note changes while the picker is open, applying a choice must not corrupt or overwrite unrelated text.

---

### Task 1: Test tooling and token parser

**Files:**
- Modify: `package.json`
- Create: `src/features/icon-syntax/token.ts`
- Test: `tests/icon-syntax/token.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `findIconTokens(text: string): IconToken[]` and `formatToken(name: string): string`, with `IconToken = { raw: string; name: string; from: number; to: number }`.

- [ ] **Step 1: Install Vitest and add the test script**

Run:

```bash
npm install --save-dev vitest
```

In `package.json`, add to `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing tests**

Create `tests/icon-syntax/token.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findIconTokens, formatToken } from "../../src/features/icon-syntax/token";

describe("findIconTokens", () => {
	it("finds tokens, keeps raw text, and trims names", () => {
		const text = 'Run %" folder-open "% then %"check"%';
		expect(findIconTokens(text)).toEqual([
			{ raw: '%" folder-open "%', name: "folder-open", from: 4, to: 21 },
			{ raw: '%"check"%', name: "check", from: 27, to: 36 },
		]);
	});

	it("ignores empty names", () => {
		expect(findIconTokens('a %""% b %"   "% c')).toEqual([]);
	});

	it("does not match across newlines", () => {
		expect(findIconTokens('%"folder\nopen"%')).toEqual([]);
	});
});

describe("formatToken", () => {
	it("wraps the name in the syntax", () => {
		expect(formatToken("folder-open")).toBe('%"folder-open"%');
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test -- tests/icon-syntax/token.test.ts`
Expected: FAIL because `src/features/icon-syntax/token.ts` does not exist.

- [ ] **Step 4: Implement the parser**

Create `src/features/icon-syntax/token.ts`:

```ts
export interface IconToken {
	/** Full matched text, for example `%"folder-open"%`. */
	raw: string;
	/** Icon ID between the quotes, trimmed. */
	name: string;
	/** Start index within the scanned string. */
	from: number;
	/** End index, exclusive. */
	to: number;
}

const TOKEN_PATTERN = /%"([^"%\n]+)"%/g;

/** Finds every icon token in a plain-text string. */
export function findIconTokens(text: string): IconToken[] {
	const tokens: IconToken[] = [];
	for (const match of text.matchAll(TOKEN_PATTERN)) {
		const raw = match[0];
		const name = (match[1] ?? "").trim();
		if (!name) continue;
		const from = match.index;
		tokens.push({ raw, name, from, to: from + raw.length });
	}
	return tokens;
}

/** Builds the syntax for one icon name. */
export function formatToken(name: string): string {
	return `%"${name}"%`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- tests/icon-syntax/token.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/features/icon-syntax/token.ts tests/icon-syntax/token.test.ts
git commit -m "test(icon-syntax): add token parser with vitest"
```

---

### Task 2: Pagination and catalog filtering

**Files:**
- Create: `src/features/icon-syntax/pagination.ts`
- Create: `src/features/icon-syntax/catalog.ts`
- Test: `tests/icon-syntax/pagination.test.ts`
- Test: `tests/icon-syntax/catalog.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PAGE_SIZE = 60`, `paginate<T>(items, page, pageSize?): Page<T>` where `Page<T> = { items: T[]; page: number; pageCount: number }`, and `filterIconIds(ids, query): string[]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/icon-syntax/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { paginate } from "../../src/features/icon-syntax/pagination";

const items = Array.from({ length: 125 }, (_, i) => `icon-${i}`);

describe("paginate", () => {
	it("returns the first page and total pages", () => {
		const result = paginate(items, 1);
		expect(result.items).toHaveLength(60);
		expect(result.items[0]).toBe("icon-0");
		expect(result.page).toBe(1);
		expect(result.pageCount).toBe(3);
	});

	it("returns the last partial page", () => {
		const result = paginate(items, 3);
		expect(result.items).toHaveLength(5);
		expect(result.items[0]).toBe("icon-120");
	});

	it("clamps out-of-range pages", () => {
		expect(paginate(items, 0).page).toBe(1);
		expect(paginate(items, 99).page).toBe(3);
	});

	it("keeps one page for an empty list", () => {
		const result = paginate([], 1);
		expect(result.items).toEqual([]);
		expect(result.pageCount).toBe(1);
	});
});
```

Create `tests/icon-syntax/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterIconIds } from "../../src/features/icon-syntax/catalog";

const ids = ["folder", "folder-open", "lucide-star", "star", "check"];

describe("filterIconIds", () => {
	it("returns everything for an empty query", () => {
		expect(filterIconIds(ids, "  ")).toEqual(ids);
	});

	it("matches case-insensitive substrings", () => {
		expect(filterIconIds(ids, "FOLDER")).toEqual(["folder", "folder-open"]);
	});

	it("matches without the lucide prefix", () => {
		expect(filterIconIds(ids, "lucide-star")).toEqual(["lucide-star", "star"]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/icon-syntax/pagination.test.ts tests/icon-syntax/catalog.test.ts`
Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement both helpers**

Create `src/features/icon-syntax/pagination.ts`:

```ts
export const PAGE_SIZE = 60;

export interface Page<T> {
	items: T[];
	page: number;
	pageCount: number;
}

/** Slices a list into a clamped page. */
export function paginate<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE): Page<T> {
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const current = Math.min(Math.max(1, page), pageCount);
	const start = (current - 1) * pageSize;
	return { items: items.slice(start, start + pageSize), page: current, pageCount };
}
```

Create `src/features/icon-syntax/catalog.ts`:

```ts
/** Filters icon IDs by substring, ignoring case and an optional lucide prefix. */
export function filterIconIds(ids: readonly string[], query: string): string[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...ids];
	const bare = needle.startsWith("lucide-") ? needle.slice("lucide-".length) : needle;
	return ids.filter((id) => {
		const lower = id.toLowerCase();
		return lower.includes(needle) || lower.replace(/^lucide-/, "").includes(bare);
	});
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/icon-syntax/pagination.test.ts tests/icon-syntax/catalog.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/icon-syntax/pagination.ts src/features/icon-syntax/catalog.ts tests/icon-syntax/pagination.test.ts tests/icon-syntax/catalog.test.ts
git commit -m "test(icon-syntax): add pagination and icon filtering"
```

---

### Task 3: Text occurrence replacement

**Files:**
- Create: `src/features/icon-syntax/text-edit.ts`
- Test: `tests/icon-syntax/text-edit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `replaceOccurrence(text: string, raw: string, occurrence: number, name: string): string | null` and `findOccurrence(text: string, raw: string, occurrence: number): { from: number; to: number } | null`.

- [ ] **Step 1: Write the failing tests**

Create `tests/icon-syntax/text-edit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findOccurrence, replaceOccurrence } from "../../src/features/icon-syntax/text-edit";

const raw = '%"folder"%';

describe("findOccurrence", () => {
	it("finds the requested occurrence", () => {
		const text = `a ${raw} b ${raw} c`;
		expect(findOccurrence(text, raw, 1)).toEqual({ from: 15, to: 25 });
	});

	it("returns null when the occurrence is missing", () => {
		expect(findOccurrence(`a ${raw}`, raw, 2)).toBeNull();
	});
});

describe("replaceOccurrence", () => {
	it("replaces only the requested occurrence", () => {
		const text = `a ${raw} b ${raw}`;
		expect(replaceOccurrence(text, raw, 1, "star")).toBe('a %"folder"% b %"star"%');
	});

	it("returns null when the token is gone", () => {
		expect(replaceOccurrence("nothing here", raw, 0, "star")).toBeNull();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- tests/icon-syntax/text-edit.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement the helper**

Create `src/features/icon-syntax/text-edit.ts`:

```ts
import { formatToken } from "./token";

/** Locates the nth occurrence of raw text. */
export function findOccurrence(
	text: string,
	raw: string,
	occurrence: number,
): { from: number; to: number } | null {
	if (occurrence < 0) return null;
	let index = -1;
	for (let i = 0; i <= occurrence; i++) {
		index = text.indexOf(raw, index + 1);
		if (index === -1) return null;
	}
	return { from: index, to: index + raw.length };
}

/** Replaces the nth occurrence with a new icon token. */
export function replaceOccurrence(
	text: string,
	raw: string,
	occurrence: number,
	name: string,
): string | null {
	const range = findOccurrence(text, raw, occurrence);
	if (!range) return null;
	return text.slice(0, range.from) + formatToken(name) + text.slice(range.to);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- tests/icon-syntax/text-edit.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/icon-syntax/text-edit.ts tests/icon-syntax/text-edit.test.ts
git commit -m "test(icon-syntax): add occurrence replacement helper"
```

---

### Task 4: Icon box and styles

**Files:**
- Create: `src/features/icon-syntax/icon-box.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `formatToken` is not needed here; `getIcon`, `setIcon`, `setTooltip` from `obsidian`.
- Produces: `createIconBox(options: { name: string; onActivate: () => void }): HTMLSpanElement` and `updateIconBox(box: HTMLElement, name: string): void`.

- [ ] **Step 1: Implement the box factory**

Create `src/features/icon-syntax/icon-box.ts`:

```ts
import { getIcon, setIcon, setTooltip } from "obsidian";

const FALLBACK_ICON = "help-circle";

export interface IconBoxOptions {
	name: string;
	onActivate: () => void;
}

/** Picks the exact icon ID, then the lowercase variant, then the fallback. */
function resolveIcon(name: string): string {
	for (const candidate of [name, name.toLowerCase()]) {
		if (getIcon(candidate)) return candidate;
	}
	return FALLBACK_ICON;
}

/** Applies the icon and its labels to an existing box. */
function paint(box: HTMLElement, name: string): void {
	const icon = resolveIcon(name);
	box.empty();
	setIcon(box, icon);
	box.dataset.iconName = name;
	box.setAttribute("aria-label", `Replace icon ${name}`);
	box.toggleClass("is-missing", icon === FALLBACK_ICON);
	if (icon === FALLBACK_ICON) {
		setTooltip(box, `Unknown icon: ${name}`);
	}
}

/** Builds one clickable icon box. */
export function createIconBox(options: IconBoxOptions): HTMLSpanElement {
	const box = createSpan({ cls: "overlay-icon-box" });
	box.tabIndex = 0;
	box.setAttribute("role", "button");
	paint(box, options.name);

	box.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		options.onActivate();
	});
	box.addEventListener("keydown", (event) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		options.onActivate();
	});
	return box;
}

/** Repaints a box after a new icon was chosen. */
export function updateIconBox(box: HTMLElement, name: string): void {
	paint(box, name);
}
```

- [ ] **Step 2: Add the styles**

Append to `styles.css`:

```css
/**
 * Inline Icon Box
 * Target: Rendered icon-syntax tokens in Reading view and Live Preview
 * What: matches the checklist checkbox and centers a 14px glyph.
 */
.overlay-icon-box {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	box-sizing: content-box;
	width: 22px;
	height: 22px;
	padding: 0;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	background-color: var(--overlay-canvas);
	color: var(--text-normal);
	vertical-align: middle;
	cursor: pointer;
	flex-shrink: 0;
}

.overlay-icon-box:hover {
	border-color: var(--background-modifier-border-hover);
}

.overlay-icon-box:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 1px;
}

.overlay-icon-box .svg-icon {
	width: 14px;
	height: 14px;
	stroke-width: var(--icon-s-stroke-width);
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build passes; lint reports no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/icon-syntax/icon-box.ts styles.css
git commit -m "feature(icon-syntax): add themed inline icon box"
```

---

### Task 5: Icon picker modal

**Files:**
- Create: `src/features/icon-syntax/picker-modal.ts`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `filterIconIds` from `./catalog`, `paginate` from `./pagination`.
- Produces: `openIconPicker(app: App, current: string, onChoose: (name: string) => void): void`.

- [ ] **Step 1: Implement the modal**

Create `src/features/icon-syntax/picker-modal.ts`:

```ts
import { Modal, getIconIds, setIcon, type App } from "obsidian";
import { filterIconIds } from "./catalog";
import { paginate } from "./pagination";

let activePicker: IconPickerModal | null = null;

/** Opens one picker at a time. */
export function openIconPicker(app: App, current: string, onChoose: (name: string) => void): void {
	activePicker?.close();
	activePicker = new IconPickerModal(app, current, (name) => {
		activePicker = null;
		onChoose(name);
	});
	activePicker.open();
}

class IconPickerModal extends Modal {
	private query = "";
	private page = 1;
	private resultsEl!: HTMLElement;
	private footerEl!: HTMLElement;
	private readonly iconIds = getIconIds().slice().sort((a, b) => a.localeCompare(b));

	constructor(
		app: App,
		private readonly current: string,
		private readonly onChoose: (name: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText("Choose an icon");
		this.contentEl.addClass("overlay-icon-picker");

		const search = this.contentEl.createEl("input", {
			type: "search",
			cls: "overlay-icon-picker__search",
			attr: { placeholder: "Search icons…", "aria-label": "Search icons" },
		});
		search.addEventListener("input", () => {
			this.query = search.value;
			this.page = 1;
			this.renderResults();
		});

		this.resultsEl = this.contentEl.createDiv({ cls: "overlay-icon-picker__results" });
		this.footerEl = this.contentEl.createDiv({ cls: "overlay-icon-picker__footer" });
		this.renderResults();
		search.focus();
	}

	onClose(): void {
		this.contentEl.empty();
		if (activePicker === this) activePicker = null;
	}

	private renderResults(): void {
		this.resultsEl.empty();
		this.footerEl.empty();
		const matches = filterIconIds(this.iconIds, this.query);
		const { items, page, pageCount } = paginate(matches, this.page);
		this.page = page;

		if (items.length === 0) {
			this.resultsEl.createDiv({
				cls: "overlay-icon-picker__empty",
				text: "No icons match your search.",
			});
		} else {
			const grid = this.resultsEl.createDiv({ cls: "overlay-icon-picker__grid" });
			for (const id of items) {
				const tile = grid.createEl("button", {
					cls: `overlay-icon-picker__tile${id === this.current ? " is-active" : ""}`,
					attr: {
						type: "button",
						"aria-label": id,
						"aria-pressed": String(id === this.current),
					},
				});
				const glyph = tile.createSpan({ cls: "overlay-icon-picker__glyph" });
				setIcon(glyph, id);
				tile.createSpan({ cls: "overlay-icon-picker__label", text: id });
				tile.addEventListener("click", () => this.choose(id));
			}
		}

		const previous = this.footerEl.createEl("button", { text: "Previous", attr: { type: "button" } });
		const pageLabel = this.footerEl.createSpan({
			cls: "overlay-icon-picker__page",
			text: `Page ${page} of ${pageCount}`,
		});
		const next = this.footerEl.createEl("button", { text: "Next", attr: { type: "button" } });
		previous.disabled = page <= 1;
		next.disabled = page >= pageCount;
		previous.addEventListener("click", () => {
			this.page = page - 1;
			this.renderResults();
		});
		next.addEventListener("click", () => {
			this.page = page + 1;
			this.renderResults();
		});
		void pageLabel;
	}

	private choose(name: string): void {
		this.close();
		this.onChoose(name);
	}
}
```

- [ ] **Step 2: Add the picker styles**

Append to `styles.css`:

```css
/**
 * Icon Picker
 * Target: The icon-syntax picker modal
 * What: searchable paginated grid using the inline box visual.
 */
.overlay-icon-picker__search {
	width: 100%;
	margin-block-end: var(--size-4-3);
}

.overlay-icon-picker__grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
	gap: var(--size-4-2);
	max-height: 55vh;
	overflow-y: auto;
	padding-block-end: var(--size-4-2);
}

.overlay-icon-picker__tile {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--size-4-1);
	padding: var(--size-4-2);
	border: 1px solid transparent;
	border-radius: var(--radius-s);
	background: transparent;
	cursor: pointer;
	min-width: 0;
}

.overlay-icon-picker__tile:hover {
	background: var(--background-modifier-hover);
}

.overlay-icon-picker__tile.is-active {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

.overlay-icon-picker__glyph {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	background-color: var(--overlay-canvas);
	color: var(--text-normal);
}

.overlay-icon-picker__glyph .svg-icon {
	width: 14px;
	height: 14px;
}

.overlay-icon-picker__label {
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
}

.overlay-icon-picker__empty {
	padding: var(--size-4-4);
	text-align: center;
	color: var(--text-muted);
}

.overlay-icon-picker__footer {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--size-4-2);
	margin-block-start: var(--size-4-3);
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build passes; lint reports no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/icon-syntax/picker-modal.ts styles.css
git commit -m "feature(icon-syntax): add searchable paginated icon picker"
```

---

### Task 6: Reading view rendering and persistence

**Files:**
- Create: `src/features/icon-syntax/reading-view.ts`
- Create: `src/features/icon-syntax/index.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: `findIconTokens`, `createIconBox`, `updateIconBox`, `openIconPicker`, `replaceOccurrence`.
- Produces: `registerReadingView(plugin: Plugin): void` and `registerIconSyntaxFeature(plugin: Plugin): void`.

- [ ] **Step 1: Implement the Reading-view renderer**

Create `src/features/icon-syntax/reading-view.ts`:

```ts
import {
	Notice,
	TFile,
	type App,
	type MarkdownPostProcessorContext,
	type Plugin,
} from "obsidian";
import { createIconBox, updateIconBox } from "./icon-box";
import { openIconPicker } from "./picker-modal";
import { replaceOccurrence } from "./text-edit";
import { findIconTokens } from "./token";

/** Registers the Reading-view post-processor. */
export function registerReadingView(plugin: Plugin): void {
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		renderElement(plugin.app, el, ctx);
	});
}

/** Replaces icon tokens inside one rendered block. */
function renderElement(app: App, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
	const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	while (walker.nextNode()) {
		const node = walker.currentNode as Text;
		if (shouldSkip(node)) continue;
		if (findIconTokens(node.data).length > 0) nodes.push(node);
	}
	for (const node of nodes) replaceTextNode(app, node, ctx);
}

/** Leaves code, math, and frontmatter untouched. */
function shouldSkip(node: Text): boolean {
	return Boolean(node.parentElement?.closest("code, pre, .math, .frontmatter"));
}

/** Splits a text node into text and icon boxes. */
function replaceTextNode(app: App, node: Text, ctx: MarkdownPostProcessorContext): void {
	const tokens = findIconTokens(node.data);
	const fragment = node.ownerDocument.createDocumentFragment();
	let cursor = 0;
	for (const token of tokens) {
		fragment.append(node.data.slice(cursor, token.from));
		const box = createIconBox({
			name: token.name,
			onActivate: () => {
				const occurrence = getOccurrence(box, token.name);
				openIconPicker(app, token.name, (name) => {
					void applyReadingEdit(app, ctx, token.raw, occurrence, name, box);
				});
			},
		});
		fragment.append(box);
		cursor = token.to;
	}
	fragment.append(node.data.slice(cursor));
	node.replaceWith(fragment);
}

/** Counts identical boxes before this one in the same preview section. */
function getOccurrence(box: HTMLElement, name: string): number {
	const scope = box.closest(".markdown-preview-section") ?? box.ownerDocument;
	const matches = Array.from(
		scope.querySelectorAll<HTMLElement>(
			`.overlay-icon-box[data-icon-name="${CSS.escape(name)}"]`,
		),
	);
	return matches.indexOf(box);
}

/** Rewrites the clicked token in the note and repaints the box. */
async function applyReadingEdit(
	app: App,
	ctx: MarkdownPostProcessorContext,
	raw: string,
	occurrence: number,
	name: string,
	box: HTMLElement,
): Promise<void> {
	const info = ctx.getSectionInfo(box);
	const file = app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!info || !(file instanceof TFile)) {
		new Notice("Could not locate this icon in the note.");
		return;
	}

	let found = true;
	try {
		await app.vault.process(file, (data) => {
			const lines = data.split("\n");
			const end = info.lineEnd + 1;
			const section = lines.slice(info.lineStart, end).join("\n");
			const updated = replaceOccurrence(section, raw, occurrence, name);
			if (updated === null) {
				found = false;
				return data;
			}
			return [
				...lines.slice(0, info.lineStart),
				...updated.split("\n"),
				...lines.slice(end),
			].join("\n");
		});
	} catch (error) {
		new Notice(`Could not update the icon: ${String(error)}`);
		return;
	}

	if (!found) {
		new Notice("The icon syntax changed; nothing was updated.");
		return;
	}
	updateIconBox(box, name);
}
```

- [ ] **Step 2: Register the feature**

Create `src/features/icon-syntax/index.ts`:

```ts
import type { Plugin } from "obsidian";
import { registerReadingView } from "./reading-view";

/** Registers every icon-syntax surface. */
export function registerIconSyntaxFeature(plugin: Plugin): void {
	registerReadingView(plugin);
}
```

Modify `src/main.ts`:

```ts
import { registerIconSyntaxFeature } from './features/icon-syntax';
```

Add inside `onload`, after `registerFileIconsFeature(this)`:

```ts
registerIconSyntaxFeature(this);
```

- [ ] **Step 3: Build, lint, and test**

Run: `npm run build && npm run lint && npm test`
Expected: build passes, lint shows only the existing command-ID warning, all tests pass.

- [ ] **Step 4: Manual verification in Obsidian**

1. Reload the Overlay plugin.
2. Create a note with:

```md
Folder: %"folder"% Missing: %"not-a-real-icon"% Code: `%"star"%`
```

3. In Reading view confirm: two boxes render, the missing one shows `help-circle` with a tooltip, the inline-code token stays text.
4. Click the folder box, search `star`, choose it; confirm the note now contains `%"star"%` and the box updates.
5. Add two identical `%"folder"%` tokens in one paragraph; click the second one, choose a new icon; confirm only the second token changed.

- [ ] **Step 5: Commit**

```bash
git add src/features/icon-syntax/reading-view.ts src/features/icon-syntax/index.ts src/main.ts
git commit -m "feature(icon-syntax): render icons in reading view"
```

---

### Task 7: Live Preview rendering and persistence

**Files:**
- Create: `src/features/icon-syntax/live-preview.ts`
- Modify: `src/features/icon-syntax/index.ts`

**Interfaces:**
- Consumes: `findIconTokens`, `formatToken`, `createIconBox`, `openIconPicker`.
- Produces: `createIconSyntaxExtension(app: App): Extension`.

- [ ] **Step 1: Implement the CodeMirror extension**

Create `src/features/icon-syntax/live-preview.ts`:

```ts
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type Extension } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	ViewPlugin,
	WidgetType,
	type DecorationSet,
	type ViewUpdate,
} from "@codemirror/view";
import { Notice, type App } from "obsidian";
import { createIconBox } from "./icon-box";
import { openIconPicker } from "./picker-modal";
import { findIconTokens, formatToken } from "./token";

const SKIP_NODE = /code|math|frontmatter/i;

class IconWidget extends WidgetType {
	constructor(
		readonly raw: string,
		readonly name: string,
		readonly from: number,
		readonly to: number,
		readonly app: App,
	) {
		super();
	}

	eq(other: IconWidget): boolean {
		return (
			other.raw === this.raw &&
			other.name === this.name &&
			other.from === this.from &&
			other.to === this.to
		);
	}

	toDOM(view: EditorView): HTMLElement {
		return createIconBox({
			name: this.name,
			onActivate: () => {
				openIconPicker(this.app, this.name, (name) => {
					const current = view.state.doc.sliceString(this.from, this.to);
					if (current !== this.raw) {
						new Notice("The icon syntax changed; nothing was updated.");
						return;
					}
					view.dispatch({
						changes: { from: this.from, to: this.to, insert: formatToken(name) },
					});
				});
			},
		});
	}
}

/** Detects whether a range belongs to a skipped syntax node. */
function isSkipped(view: EditorView, from: number, to: number): boolean {
	const tree = syntaxTree(view.state);
	for (const pos of [from, to]) {
		for (let node = tree.resolveInner(pos, 1); node; node = node.parent) {
			if (SKIP_NODE.test(node.name)) return true;
		}
	}
	return false;
}

/** Builds widgets for every visible token outside the cursor. */
function buildDecorations(view: EditorView, app: App): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const selection = view.state.selection;
	for (const range of view.visibleRanges) {
		const text = view.state.doc.sliceString(range.from, range.to);
		for (const token of findIconTokens(text)) {
			const from = range.from + token.from;
			const to = range.from + token.to;
			if (selection.ranges.some((sel) => sel.from <= to && sel.to >= from)) continue;
			if (isSkipped(view, from, to)) continue;
			builder.add(
				from,
				to,
				Decoration.replace({
					widget: new IconWidget(token.raw, token.name, from, to, app),
				}),
			);
		}
	}
	return builder.finish();
}

/** Creates the Live Preview extension for one workspace. */
export function createIconSyntaxExtension(app: App): Extension {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = buildDecorations(view, app);
			}

			update(update: ViewUpdate): void {
				if (update.docChanged || update.selectionSet || update.viewportChanged) {
					this.decorations = buildDecorations(update.view, app);
				}
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}
```

- [ ] **Step 2: Register the extension**

In `src/features/icon-syntax/index.ts`:

```ts
import type { Plugin } from "obsidian";
import { createIconSyntaxExtension } from "./live-preview";
import { registerReadingView } from "./reading-view";

/** Registers every icon-syntax surface. */
export function registerIconSyntaxFeature(plugin: Plugin): void {
	registerReadingView(plugin);
	plugin.registerEditorExtension(createIconSyntaxExtension(plugin.app));
}
```

- [ ] **Step 3: Build, lint, and test**

Run: `npm run build && npm run lint && npm test`
Expected: build passes, lint shows only the existing warning, all tests pass.

- [ ] **Step 4: Manual verification in Live Preview**

1. Reload the plugin and open the test note in Live Preview.
2. Confirm tokens render as boxes and inline/fenced code tokens stay raw.
3. Place the cursor inside a token with the arrow keys; confirm the raw syntax reappears; move away and confirm the box returns.
4. Click a box, choose a new icon, and confirm the token updates in the editor and the file saves.
5. Open the picker, keep it open, type in the note, then choose an icon; confirm the “syntax changed” notice appears and no text is corrupted.

- [ ] **Step 5: Commit**

```bash
git add src/features/icon-syntax/live-preview.ts src/features/icon-syntax/index.ts
git commit -m "feature(icon-syntax): render icons in live preview"
```

---

### Task 8: Final verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-28-icon-syntax-design.md` if any behavior changed during implementation

**Interfaces:**
- Consumes: everything above.
- Produces: user-facing syntax documentation and a clean build.

- [ ] **Step 1: Document the syntax in `README.md`**

Add a section with this exact content:

```md
## Inline icons

Write `%"icon-name"%` in a note to render an icon inside a box that matches the
checklist checkbox. Click the box to open the icon picker, search by name, and
choose a replacement; the note is updated automatically.

Icons available in the picker come from the running Obsidian version. Unknown
names render `help-circle` and stay clickable. The syntax is ignored inside
code, math, and frontmatter.
```

- [ ] **Step 2: Run the full verification**

Run:

```bash
npm run build
npm run lint
npm test
git status --short
```

Expected: build passes; lint reports only the existing command-ID warning; all tests pass; only the files listed in this task are modified.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-28-icon-syntax-design.md
git commit -m "docs(icon-syntax): document the inline icon syntax"
```

---

## Plan self-review

- Spec coverage: syntax parsing (Task 1), catalog/pagination (Task 2), replacement (Task 3), box styles (Task 4), picker (Task 5), Reading view (Task 6), Live Preview (Task 7), documentation (Task 8).
- Placeholders: none; every step contains the code or command.
- Type consistency: `findIconTokens`, `formatToken`, `paginate`, `filterIconIds`, `replaceOccurrence`, `createIconBox`, `updateIconBox`, `openIconPicker`, `registerReadingView`, `createIconSyntaxExtension`, and `registerIconSyntaxFeature` are defined before use.
- Review focus: covered by token tests, occurrence tests, manual code-skip and cursor-reveal checks, fallback rendering, and offset validation.
