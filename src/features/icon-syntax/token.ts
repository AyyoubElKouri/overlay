export interface IconToken {
	/** Full matched text, for example `%"folder-open"%`. */
	raw: string;
	/** Icon ID between the quotes, trimmed. */
	name: string;
	/** Start index within the scanned string. */
	from: number;
	/** End index, exclusive. */
	to: number;
}

const TOKEN_PATTERN = /%"([^"%\n]+)"%/g;

/** Finds every icon token in a plain-text string. */
export function findIconTokens(text: string): IconToken[] {
	const tokens: IconToken[] = [];
	for (const match of text.matchAll(TOKEN_PATTERN)) {
		const raw = match[0];
		const name = (match[1] ?? "").trim();
		if (!name) continue;
		const from = match.index;
		tokens.push({ raw, name, from, to: from + raw.length });
	}
	return tokens;
}

/** Builds the syntax for one icon name. */
export function formatToken(name: string): string {
	return `%"${name}"%`;
}
