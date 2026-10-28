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
