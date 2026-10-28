/** Fallback icon used when a name cannot be resolved. */
export const FALLBACK_ICON = "help-circle";

export interface ResolvedIcon {
	/** Icon ID to render. */
	id: string;
	/** True when no candidate matched and the fallback was used. */
	missing: boolean;
}

/**
 * Picks the exact icon ID, then the lowercase variant, then the fallback.
 * The lookup is injected so the resolution stays pure and testable.
 */
export function resolveIcon(name: string, hasIcon: (id: string) => boolean): ResolvedIcon {
	for (const candidate of [name, name.toLowerCase()]) {
		if (hasIcon(candidate)) return { id: candidate, missing: false };
	}
	return { id: FALLBACK_ICON, missing: true };
}
