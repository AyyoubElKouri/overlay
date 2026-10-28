import { Notice, type App, type Plugin } from "obsidian";
import { createIconBox } from "./icon-box";
import { findIconTokens } from "./token";

/** Containers whose text must stay literal. */
const SKIP_SELECTOR =
	"code, pre, .math, .math-inline, .math-block, .frontmatter, .html-block";

/** Registers the Reading-view post-processor. */
export function registerReadingView(plugin: Plugin): void {
	plugin.registerMarkdownPostProcessor((el) => {
		renderElement(plugin.app, el);
	});
}

/** Replaces icon tokens inside one rendered block. */
function renderElement(_app: App, el: HTMLElement): void {
	const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	const nodes: Text[] = [];
	while (walker.nextNode()) {
		const node = walker.currentNode as Text;
		if (shouldSkip(node)) continue;
		if (findIconTokens(node.data).length > 0) nodes.push(node);
	}
	for (const node of nodes) replaceTextNode(node);
}

/** Leaves code, math, frontmatter, and raw HTML untouched. */
function shouldSkip(node: Text): boolean {
	return Boolean(node.parentElement?.closest(SKIP_SELECTOR));
}

/**
 * Splits a text node into text and icon boxes.
 * Reading view is read-only for icons: the picker would have to rewrite the
 * markdown behind the rendered block, so the box only explains the limitation.
 */
function replaceTextNode(node: Text): void {
	const tokens = findIconTokens(node.data);
	const fragment = node.ownerDocument.createDocumentFragment();
	let cursor = 0;
	for (const token of tokens) {
		fragment.append(node.data.slice(cursor, token.from));
		fragment.append(
			createIconBox({
				name: token.name,
				raw: token.raw,
				onActivate: () => {
					new Notice("You can't update the icon in preview mode.");
				},
			}),
		);
		cursor = token.to;
	}
	fragment.append(node.data.slice(cursor));
	node.replaceWith(fragment);
}
