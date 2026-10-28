/** Filters icon IDs by substring, ignoring case and an optional lucide prefix. */
export function filterIconIds(ids: readonly string[], query: string): string[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...ids];
	const bare = needle.startsWith("lucide-") ? needle.slice("lucide-".length) : "";
	return ids.filter((id) => {
		const lower = id.toLowerCase();
		if (lower.includes(needle)) return true;
		if (!bare) return false;
		return lower.replace(/^lucide-/, "").includes(bare);
	});
}
