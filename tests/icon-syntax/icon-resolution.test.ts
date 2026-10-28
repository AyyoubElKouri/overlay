import { describe, expect, it } from "vitest";
import { resolveIcon } from "../../src/features/icon-syntax/icon-resolution";

const catalog =
	(ids: readonly string[]) =>
	(id: string): boolean =>
		ids.includes(id);

describe("resolveIcon", () => {
	it("returns an exact match", () => {
		expect(resolveIcon("folder-open", catalog(["folder-open"]))).toEqual({
			id: "folder-open",
			missing: false,
		});
	});

	it("falls back to the lowercase ID", () => {
		expect(resolveIcon("Folder-Open", catalog(["folder-open"]))).toEqual({
			id: "folder-open",
			missing: false,
		});
	});

	it("returns help-circle and marks it missing", () => {
		expect(resolveIcon("not-a-real-icon", catalog([]))).toEqual({
			id: "help-circle",
			missing: true,
		});
	});

	it("treats a real help-circle icon as resolved", () => {
		expect(resolveIcon("help-circle", catalog(["help-circle"]))).toEqual({
			id: "help-circle",
			missing: false,
		});
	});
});
