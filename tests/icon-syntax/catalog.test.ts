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

	it("does not match everything for a bare lucide prefix", () => {
		expect(filterIconIds(ids, "lucide-")).toEqual(["lucide-star"]);
	});
});
