import { syntaxTree } from "@codemirror/language";
import { type Extension, type Range } from "@codemirror/state";
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

const SKIP_NODE = /code|math|tex|frontmatter|comment|html/i;

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
			raw: this.raw,
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
		let node = tree.resolveInner(pos, 1);
		while (true) {
			if (SKIP_NODE.test(node.name)) return true;
			const parent = node.parent;
			if (!parent) break;
			node = parent;
		}
	}
	return false;
}

/** Detects a token that starts its line, after only a list marker or whitespace. */
function startsLineContent(view: EditorView, from: number): boolean {
	const line = view.state.doc.lineAt(from);
	const before = line.text.slice(0, from - line.from);
	return /^\s*$/.test(before) || /^\s*(?:[-*+]|\d+[.)])\s*$/.test(before);
}

/** Builds widgets for every visible token outside the cursor. */
function buildDecorations(view: EditorView, app: App): DecorationSet {
	const decorations: Range<Decoration>[] = [];
	const selection = view.state.selection;
	for (const range of view.visibleRanges) {
		const text = view.state.doc.sliceString(range.from, range.to);
		for (const token of findIconTokens(text)) {
			const from = range.from + token.from;
			const to = range.from + token.to;
			if (selection.ranges.some((sel) => sel.from <= to && sel.to >= from)) continue;
			if (isSkipped(view, from, to)) continue;
			if (startsLineContent(view, from)) {
				const line = view.state.doc.lineAt(from);
				decorations.push(Decoration.line({ class: "overlay-icon-line" }).range(line.from));
			}
			decorations.push(
				Decoration.replace({
					widget: new IconWidget(token.raw, token.name, from, to, app),
				}).range(from, to),
			);
		}
	}
	return Decoration.set(decorations, true);
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
				const treeChanged = syntaxTree(update.state) !== syntaxTree(update.startState);
				if (
					update.docChanged ||
					update.selectionSet ||
					update.viewportChanged ||
					treeChanged
				) {
					this.decorations = buildDecorations(update.view, app);
				}
			}
		},
		{ decorations: (plugin) => plugin.decorations },
	);
}
