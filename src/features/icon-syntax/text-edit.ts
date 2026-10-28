import { formatToken } from "./token";

/** Splits text into lines, accepting CRLF, CR, and LF endings. */
export function splitLines(text: string): string[] {
	return text.split(/\r\n|\r|\n/);
}

/** Returns the file's dominant line ending, defaulting to LF. */
export function detectLineEnding(text: string): "\n" | "\r\n" {
	const total = (text.match(/\n/g) ?? []).length;
	const crlf = (text.match(/\r\n/g) ?? []).length;
	return crlf > total - crlf ? "\r\n" : "\n";
}

/** Normalizes CRLF and CR endings to LF for comparison. */
export function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n?/g, "\n");
}

/** Trims the trailing newlines that section boundaries may add or omit. */
function trimTrailingNewlines(text: string): string {
	return text.replace(/\n+$/, "");
}

/** Compares section text, ignoring line-ending style and trailing newlines. */
export function sameSectionText(a: string, b: string): boolean {
	return trimTrailingNewlines(normalizeLineEndings(a)) === trimTrailingNewlines(normalizeLineEndings(b));
}

interface SectionRange {
	from: number;
	to: number;
}

/** Returns the character offsets of lines start..end, including the end separator. */
function sectionRange(data: string, lineStart: number, lineEnd: number): SectionRange | null {
	const starts = [0];
	for (const match of data.matchAll(/\r?\n/g)) {
		starts.push(match.index + match[0].length);
	}
	const from = starts[lineStart];
	if (from === undefined || lineEnd < lineStart) return null;
	const to = starts[lineEnd + 1] ?? data.length;
	if (to < from) return null;
	return { from, to };
}

/** Reads the raw text of lines start..end, including a trailing separator. */
export function sliceSection(data: string, lineStart: number, lineEnd: number): string | null {
	const range = sectionRange(data, lineStart, lineEnd);
	if (!range) return null;
	return data.slice(range.from, range.to);
}

/**
 * Replaces lines start..end with new section text, preserving every byte
 * outside the range and the original trailing separator.
 */
export function spliceSection(
	data: string,
	lineStart: number,
	lineEnd: number,
	section: string,
): string | null {
	const range = sectionRange(data, lineStart, lineEnd);
	if (!range) return null;
	const current = data.slice(range.from, range.to);
	const trailing = /\r?\n$/.exec(current)?.[0] ?? "";
	const eol = detectLineEnding(current);
	const body = normalizeLineEndings(section)
		.replace(/\n+$/, "")
		.replace(/\n/g, eol);
	return data.slice(0, range.from) + body + trailing + data.slice(range.to);
}

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
