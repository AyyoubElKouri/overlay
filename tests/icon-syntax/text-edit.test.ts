import { describe, expect, it } from "vitest";
import {
	detectLineEnding,
	findOccurrence,
	normalizeLineEndings,
	replaceOccurrence,
	sameSectionText,
	sliceSection,
	spliceSection,
	splitLines,
} from "../../src/features/icon-syntax/text-edit";

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

describe("line ending helpers", () => {
	it("splits CRLF, CR, and LF lines", () => {
		expect(splitLines("a\r\nb\rc\nd")).toEqual(["a", "b", "c", "d"]);
	});

	it("normalizes CRLF and CR to LF", () => {
		expect(normalizeLineEndings("a\r\nb\rc\n")).toBe("a\nb\nc\n");
	});

	it("detects the dominant line ending", () => {
		expect(detectLineEnding("a\r\nb\r\nc")).toBe("\r\n");
		expect(detectLineEnding("a\nb\nc")).toBe("\n");
		expect(detectLineEnding("a")).toBe("\n");
	});

	it("matches a CRLF section against LF file content", () => {
		const file = "one\r\ntwo\r\nthree";
		const section = "one\r\ntwo";
		const current = splitLines(file).slice(0, 2).join(detectLineEnding(file));
		expect(normalizeLineEndings(current)).toBe(normalizeLineEndings(section));
	});
});

describe("sameSectionText", () => {
	it("ignores trailing newlines and line-ending style", () => {
		expect(sameSectionText("a\r\nb\r\n", "a\nb")).toBe(true);
		expect(sameSectionText("a\nb\n\n", "a\nb")).toBe(true);
	});

	it("still rejects different content", () => {
		expect(sameSectionText("a\nb", "a\nc")).toBe(false);
	});
});

describe("sliceSection", () => {
	it("returns the raw lines including the trailing separator", () => {
		const file = "one\r\ntwo\nthree";
		expect(sliceSection(file, 1, 1)).toBe("two\n");
		expect(sliceSection(file, 2, 2)).toBe("three");
	});
});

describe("spliceSection", () => {
	it("keeps mixed line endings outside the edited section", () => {
		const file = 'before\r\n%"old"%\nkeep\r\n';
		expect(spliceSection(file, 1, 1, '%"new"%\n')).toBe('before\r\n%"new"%\nkeep\r\n');
	});

	it("uses the section's own line ending", () => {
		const file = "a\r\nOLD\r\nb\nc";
		expect(spliceSection(file, 1, 1, "NEW\n")).toBe("a\r\nNEW\r\nb\nc");
	});

	it("preserves a trailing newline at end of file", () => {
		expect(spliceSection("OLD\nafter\n", 0, 0, "NEW")).toBe("NEW\nafter\n");
	});

	it("does not add a newline when the file has none", () => {
		expect(spliceSection("a\nOLD", 1, 1, "NEW\n")).toBe("a\nNEW");
	});
});
