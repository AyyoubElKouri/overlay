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
