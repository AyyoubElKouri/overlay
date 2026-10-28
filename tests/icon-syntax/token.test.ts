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
